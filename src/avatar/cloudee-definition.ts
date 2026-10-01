export interface CloudeeExpression {
  head: { x: number; y: number; z: number };
  eyes: {
    left: { width: number; height: number; x: number; y: number; angle: number };
    right: { width: number; height: number; x: number; y: number; angle: number };
    spacing: number;
  };
  perspective: number;
  motion: {
    eyes: "none" | "microSaccades" | "shake";
    body: "none" | "slowDrift" | "shake";
  };
  colors?: { body?: string; eyes?: string };
}

export interface CloudeeAnimation {
  playbackMode: "loop" | "once" | "pingPong";
  steps: Array<{
    expression: string;
    holdMs: number;
    transitionMs: number;
    transition: "spring" | "smooth" | "snappy";
  }>;
  blink: {
    enabled: boolean;
    initialDelayMs: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    durationMs: number;
  };
}

export interface CloudeeDefinition {
  schema: "bible-strong/avatar-definition";
  schemaVersion: 1;
  name: "Cloudee";
  body: {
    primary: {
      type: "sphere";
      width: number;
      height: number;
      depth: number;
      roundness: number;
    };
    nodes: Array<{
      surface: {
        type: "sphere";
        width: number;
        height: number;
        depth: number;
        roundness: number;
      };
      position: [number, number, number];
      rotation: [number, number, number];
    }>;
  };
  colors: { body: string; eyes: string };
  expressions: Record<string, CloudeeExpression>;
  animations: Record<string, CloudeeAnimation>;
}

const eye = (
  width: number,
  height: number,
  y = 5.930859375000001,
  angle = 0,
) => ({ width, height, x: 0, y, angle });

const expression = (
  head: [number, number, number],
  left: ReturnType<typeof eye>,
  right: ReturnType<typeof eye>,
  spacing: number,
  motion: CloudeeExpression["motion"] = { eyes: "none", body: "none" },
): CloudeeExpression => ({
  head: { x: head[0], y: head[1], z: head[2] },
  eyes: { left, right, spacing },
  perspective: 1,
  motion,
});

const standardBlink = {
  enabled: true,
  initialDelayMs: 2100,
  minIntervalMs: 2800,
  maxIntervalMs: 5000,
  durationMs: 260,
} as const;

const livelyBlink = {
  enabled: true,
  initialDelayMs: 1200,
  minIntervalMs: 1800,
  maxIntervalMs: 3600,
  durationMs: 220,
} as const;

const idleBlink = {
  enabled: true,
  initialDelayMs: 2600,
  minIntervalMs: 3400,
  maxIntervalMs: 6200,
  durationMs: 280,
} as const;

const attentiveBlink = {
  enabled: true,
  initialDelayMs: 3200,
  minIntervalMs: 4800,
  maxIntervalMs: 7200,
  durationMs: 240,
} as const;

const step = (expression: string, holdMs = 2300) => ({
  expression,
  holdMs,
  transitionMs: 500,
  transition: "smooth" as const,
});

const EXPRESSIONS: Record<string, CloudeeExpression> = {
  neutral: expression(
    [0, 0, 0],
    eye(13.942812499999995, 45.420312499999994, -1.0691406249999993),
    eye(13.942812499999995, 45.420312499999994, -1.0691406249999993),
    12.757031249999997,
  ),
  "upward-side-glance": expression(
    [7.3, 27.8, -16.1],
    eye(16.443984374999992, 37.798046875, -14.569140625),
    eye(16.443984374999992, 37.798046875, -14.569140625),
    32.057031249999994,
  ),
  "downward-gaze": expression(
    [-15.057812500000004, 0.14296874999999964, -14.549218750000001],
    eye(16.34398437499999, 49.990624999999994),
    eye(16.34398437499999, 49.990624999999994),
    35.45703125,
  ),
  "skeptical-right": expression(
    [-16.528515625, -3.7679687499999996, -13.7296875],
    eye(17.03343749999999, 53.099999999999994),
    eye(43.867421875, 10),
    34.057031249999994,
  ),
  "small-attentive": expression(
    [-4.232421875000001, 14.362109375000003, 11.204296875],
    eye(16.00960937499999, 35.01953125),
    eye(16.00960937499999, 35.01953125),
    28.657031249999996,
  ),
  "wide-downward-gaze": expression(
    [-19.20859375, 15.2, 11.8],
    eye(46.02757812499999, 46.88747220849807),
    eye(47.056921319169945, 47.60801244441696),
    47.25703125,
  ),
  "surprised-left": expression(
    [2.9468749999999986, -16.051171875, -20.916015625],
    eye(45.62617973153047, 47.160853587962976),
    eye(45.62617973153047, 47.160853587962976),
    48.65703125,
  ),
  "angry-right": expression(
    [8.063671874999999, 17.626562500000002, -11.116796874999999],
    eye(14.851015624999988, 35.82109375, 5.930859375000001, -30.865625),
    eye(14.851015624999988, 35.82109375, 5.930859375000001, 28.781640625),
    29.816796874999994,
  ),
  "curious-left": expression(
    [-12.303515625, -17.601171875, 5.9109375],
    eye(14.54867187499999, 43.19023437499999, 5.930859375000001, 23.523046875000002),
    eye(14.54867187499999, 43.19023437499999, 5.930859375000001, -24.042578125000002),
    32.65703124999999,
  ),
  "asymmetric-down-right": expression(
    [-20.058203125, 12.607421875, -12.7],
    eye(36.442812499999995, 37.220312500000006),
    eye(16.042812499999997, 17.620312499999997),
    39.45703125,
  ),
  "attentive-left": expression(
    [1.43359375, 6.194140624999999, 10.56015625],
    eye(17.77953124999999, 53.550390625000006),
    eye(17.77953124999999, 53.550390625000006),
    34.557031249999994,
  ),
  "joyful-wide": expression(
    [-2.092968750000001, -15.899609374999999, -14.469921875],
    eye(28.143680159732128, 80.75117187500001),
    eye(28.143680159732128, 78.59806918160692),
    37.171484375000006,
  ),
  "joyful-down-right": expression(
    [-15.287109375000002, 15.006640625, 12.787890625],
    eye(25.196718749999988, 72.141015625),
    eye(25.196718749999988, 72.141015625),
    46.45703125,
  ),
  "skeptical-left": expression(
    [3.5292968750000004, -7.0765625, 9.830078125],
    eye(18.249062499999994, 54.70195312499999),
    eye(42.867031250000004, 10),
    39.97539062499999,
  ),
  "far-right-glance": expression(
    [0.31914062500000184, 35.307421874999996, -10.904296875],
    eye(16.403749999999995, 35.241015625),
    eye(16.403749999999995, 35.241015625),
    31.65703124999999,
  ),
  "angry-left": expression(
    [-14.750781250000001, -19.350000000000005, 5.631640624999998],
    eye(13.545156249999998, 44.060156250000006, 5.930859375000001, -27.606640625),
    eye(13.545156249999998, 44.060156250000006, 5.930859375000001, 26.1484375),
    32.857031250000006,
  ),
  "playful-right": expression(
    [-4.3953125, 14.07265625, -16.126171874999997],
    eye(12.987958181988198, 38.791015625, 5.930859375000001, 26.2921875),
    eye(12.987958181988198, 38.791015625, 5.930859375000001, -20.249218750000004),
    29.48828125,
  ),
  "asymmetric-up-left": expression(
    [6.585546875, 4.737109375000001, 12.840234374999998],
    eye(36.0428125, 37.12031250000001),
    eye(16.14281249999999, 17.520312500000003),
    38.15703124999999,
  ),
  "gentle-downward-gaze": expression(
    [-6.077734375000001, -11.03515625, -13.965625000000001],
    eye(16.98851562499999, 54.10546875),
    eye(16.98851562499999, 54.10546875),
    33.95703125,
  ),
  "wide-down-left": expression(
    [-17.127734375000003, 18.070703124999998, 13.891796875],
    eye(29.395546874999994, 74.52460937500001),
    eye(29.395546874999994, 74.52460937500001),
    48.557031249999994,
  ),
  "surprised-wide-left": expression(
    [-5.428125, -11.71328125, -13.472265625000002],
    eye(45.342812499999994, 45.5203125),
    eye(44.44281249999999, 44.8203125),
    46.75703125,
  ),
};

const ANIMATIONS: Record<string, CloudeeAnimation> = {
  idle: {
    playbackMode: "loop",
    steps: [step("upward-side-glance", 5200), step("curious-left", 5200)],
    blink: idleBlink,
  },
  listening: {
    playbackMode: "loop",
    steps: [step("attentive-left"), step("downward-gaze"), step("gentle-downward-gaze")],
    blink: attentiveBlink,
  },
  thinking: {
    playbackMode: "loop",
    steps: [
      step("curious-left"),
      step("angry-left"),
      step("skeptical-left"),
      step("playful-right"),
      step("skeptical-right"),
    ],
    blink: standardBlink,
  },
  searching: {
    playbackMode: "loop",
    steps: [
      step("far-right-glance"),
      step("asymmetric-down-right"),
      step("surprised-left"),
      step("wide-down-left"),
      step("wide-downward-gaze"),
      step("asymmetric-up-left"),
    ],
    blink: standardBlink,
  },
  working: {
    playbackMode: "loop",
    steps: [
      step("angry-right"),
      step("angry-left"),
      step("joyful-wide"),
      step("attentive-left"),
    ],
    blink: standardBlink,
  },
  happy: {
    playbackMode: "loop",
    steps: [
      step("joyful-down-right"),
      step("joyful-wide"),
      step("playful-right"),
      step("gentle-downward-gaze"),
    ],
    blink: standardBlink,
  },
  curious: {
    playbackMode: "loop",
    steps: [
      step("surprised-left"),
      step("surprised-wide-left"),
      step("upward-side-glance"),
      step("far-right-glance"),
    ],
    blink: standardBlink,
  },
  confused: {
    playbackMode: "loop",
    steps: [step("skeptical-left"), step("skeptical-right"), step("curious-left")],
    blink: standardBlink,
  },
  playful: {
    playbackMode: "loop",
    steps: [
      step("joyful-down-right"),
      step("playful-right"),
      step("joyful-wide"),
      step("curious-left"),
    ],
    blink: standardBlink,
  },
  celebrate: {
    playbackMode: "loop",
    steps: [step("joyful-down-right"), step("curious-left"), step("playful-right")],
    blink: livelyBlink,
  },
};

export const NIMBI_CLOUDEE_BODY_COLOR = "#ddd8ff";

export const CLOUDEE_DEFINITION: CloudeeDefinition = {
  schema: "bible-strong/avatar-definition",
  schemaVersion: 1,
  name: "Cloudee",
  body: {
    primary: {
      type: "sphere",
      width: 159.787109375,
      height: 159.787109375,
      depth: 159.77982741038028,
      roundness: 1,
    },
    nodes: [
      {
        surface: { type: "sphere", width: 81.60000000000001, height: 81.60000000000001, depth: 81.60000000000001, roundness: 1 },
        position: [-54.211163573292225, -19.983270576375716, -18],
        rotation: [0, 0, 0],
      },
      {
        surface: { type: "sphere", width: 108.64140625000002, height: 87.10000590491492, depth: 90.99923895827905, roundness: 1 },
        position: [-64.06931629506641, 18.35102511266605, -18],
        rotation: [0, 0, 0],
      },
      {
        surface: { type: "sphere", width: 97.79101562500003, height: 96.8381380478929, depth: 89.56416057242059, roundness: 1 },
        position: [61.23234219342984, 18.962019686907013, -18],
        rotation: [0, 0, 0],
      },
      {
        surface: { type: "sphere", width: 94.34892531002268, height: 94.3451962078319, depth: 100.53515625000001, roundness: 1 },
        position: [41.48876642638391, -37.63883372407813, -17.99133043155456],
        rotation: [0, 0, 0],
      },
    ],
  },
  colors: { body: "#c9cbcf", eyes: "#111316" },
  expressions: EXPRESSIONS,
  animations: ANIMATIONS,
};

export const NIMBI_CLOUDEE_DEFINITION: CloudeeDefinition = {
  ...CLOUDEE_DEFINITION,
  colors: {
    ...CLOUDEE_DEFINITION.colors,
    body: NIMBI_CLOUDEE_BODY_COLOR,
  },
};
