import cloudeeDefinition from "./assets/cloudee.avatar.json";

export const NIMBI_CLOUDEE_BODY = "#c8c5ff";

export const CLOUDEE_DEFINITION = cloudeeDefinition;

export const NIMBI_CLOUDEE_DEFINITION = Object.freeze({
  ...cloudeeDefinition,
  colors: Object.freeze({
    ...cloudeeDefinition.colors,
    body: NIMBI_CLOUDEE_BODY,
  }),
});
