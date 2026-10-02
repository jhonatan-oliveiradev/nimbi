import { useCallback, useEffect, useRef, useState } from "react";
import type { NimbiSnapshot } from "../telemetry/contract";
import { ActionController } from "./action-controller";
import { submitNimbiAction } from "./client";
export const ACTION_RESPONSE_TTL_MS = 4_000;

import type {
  ActionComposeMode,
  ActionUiState,
  NimbiActionRequest,
  NimbiActionResult,
} from "./contract";

export interface UseNimbiActionsOptions {
  snapshot: NimbiSnapshot;
  enabled?: boolean;
  submit?: (request: NimbiActionRequest) => Promise<NimbiActionResult>;
}

export interface NimbiActions {
  state: ActionUiState;
  canRetry: boolean;
  open(mode: ActionComposeMode): void;
  setDraft(draft: string): void;
  submit(): Promise<void>;
  retry(): Promise<void>;
  close(): void;
  dismissResponse(): void;
}

function actionErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Nimbi could not send the action";
}

export function useNimbiActions({
  snapshot,
  enabled = true,
  submit: submitAction = submitNimbiAction,
}: UseNimbiActionsOptions): NimbiActions {
  const controllerRef = useRef<ActionController | null>(null);
  if (!controllerRef.current) controllerRef.current = new ActionController();
  const controller = controllerRef.current;

  const [state, setState] = useState<ActionUiState>(controller.state);
  const snapshotRef = useRef(snapshot);
  const pendingRef = useRef(false);

  const sync = useCallback(() => {
    setState({ ...controller.state });
  }, [controller]);

  useEffect(() => {
    snapshotRef.current = snapshot;
    controller.telemetryChanged(snapshot);
    sync();
  }, [controller, snapshot, sync]);

  useEffect(() => {
    if (state.status !== "response") return;
    const timer = window.setTimeout(() => {
      controller.dismissResponse();
      sync();
    }, ACTION_RESPONSE_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [controller, state.status, sync]);


  const open = useCallback(
    (mode: ActionComposeMode) => {
      if (!enabled || pendingRef.current) return;
      controller.compose(mode);
      sync();
    },
    [controller, enabled, sync],
  );

  const setDraft = useCallback(
    (draft: string) => {
      controller.updateDraft(draft);
      sync();
    },
    [controller, sync],
  );

  const dispatch = useCallback(
    async (request: NimbiActionRequest) => {
      if (!enabled || pendingRef.current) return;
      pendingRef.current = true;
      try {
        const result = await submitAction(request);
        controller.submitSucceeded(result);
      } catch (error) {
        controller.submitFailed(actionErrorMessage(error));
      } finally {
        pendingRef.current = false;
        sync();
      }
    },
    [controller, enabled, submitAction, sync],
  );

  const submit = useCallback(async () => {
    if (!enabled || pendingRef.current) return;
    const routed = controller.beginSubmit(snapshotRef.current);
    if (!routed.ok) {
      sync();
      return;
    }
    sync();
    await dispatch(routed.request);
  }, [controller, dispatch, enabled, sync]);

  const retry = useCallback(async () => {
    if (!enabled || pendingRef.current) return;
    const retrySubmission = controller.retryContext();
    if (!retrySubmission) return;

    const mode: ActionComposeMode =
      retrySubmission.context.type === "reply" ? "contextual" : "general";
    controller.compose(mode);
    controller.updateDraft(retrySubmission.request.text);
    const routed = controller.beginSubmit(snapshotRef.current);
    if (!routed.ok) {
      sync();
      return;
    }
    sync();
    await dispatch(routed.request);
  }, [controller, dispatch, enabled, sync]);

  const close = useCallback(() => {
    if (pendingRef.current) return;
    controller.reset();
    sync();
  }, [controller, sync]);

  const dismissResponse = useCallback(() => {
    controller.dismissResponse();
    sync();
  }, [controller, sync]);

  return {
    state,
    canRetry: controller.retryContext() !== null,
    open,
    setDraft,
    submit,
    retry,
    close,
    dismissResponse,
  };
}