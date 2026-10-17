export const SECONDARY_SHADOW_DETAIL = /(?:tread|bolt|ladder[-_]rung|rail[-_]post|motor[-_]fin|flywheel.*spoke|jaw[-_]rib|cathode|dump[-_]rock|reclaim[-_]ore|feed[-_]landing[-_]ore|controlled[-_]spill.*fragment)/i;

export function applySecondaryShadowPolicy(root) {
  let disabled = 0;
  root?.traverse?.((object) => {
    if (!object.isMesh || !object.castShadow) return;
    if (!SECONDARY_SHADOW_DETAIL.test(String(object.name || ''))) return;
    object.castShadow = false;
    object.userData.v24SecondaryShadowExcluded = true;
    disabled += 1;
  });
  if (root?.userData) root.userData.v24SecondaryShadowExclusions = disabled;
  return disabled;
}
