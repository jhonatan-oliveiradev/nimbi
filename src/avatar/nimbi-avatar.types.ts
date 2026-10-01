export type AvatarTarget =
  | { kind: "animation"; key: string }
  | { kind: "expression"; key: string };

export interface AvatarDefinitionTargets {
  animations: Record<string, unknown>;
  expressions: Record<string, unknown>;
}
