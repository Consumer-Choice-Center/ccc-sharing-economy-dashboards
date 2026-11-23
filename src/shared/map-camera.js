// Tilt is measured away from a top-down camera: 0 hides column heights.
export const MIN_MAP_TILT=35*Math.PI/180;
export const MAX_MAP_TILT=65*Math.PI/180;
export const DEFAULT_MAP_TILT=50*Math.PI/180;
export const clampMapTilt=value=>Number.isFinite(value)?Math.min(MAX_MAP_TILT,Math.max(MIN_MAP_TILT,value)):DEFAULT_MAP_TILT;
