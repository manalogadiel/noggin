import { vi } from "vitest";

type Listener = (event: unknown) => void;

export class MockMediaStreamTrack {
  kind = "audio";
  enabled = true;
  readyState: "live" | "ended" = "live";
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
}

export class MockMediaStream {
  private tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]) {
    this.tracks = tracks;
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }
}

export class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = vi.fn((mimeType: string) =>
    mimeType.startsWith("audio/webm") || mimeType.startsWith("audio/ogg"),
  );

  readonly stream: MockMediaStream;
  readonly mimeType: string;
  state: "inactive" | "recording" | "paused" = "inactive";

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;

  private listeners = new Map<string, Set<Listener>>();

  start = vi.fn(() => {
    this.state = "recording";
    const startEvent = new Event("start");
    this.onstart?.(startEvent);
    this.emit("start", startEvent);
  });

  stop = vi.fn(() => {
    if (this.state === "inactive") {
      return;
    }
    this.state = "inactive";
    const chunk = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], {
      type: this.mimeType || "audio/webm",
    });
    const dataEvent = Object.assign(new Event("dataavailable"), { data: chunk });
    this.ondataavailable?.(dataEvent);
    this.emit("dataavailable", dataEvent);

    const stopEvent = new Event("stop");
    this.onstop?.(stopEvent);
    this.emit("stop", stopEvent);
  });

  pause = vi.fn(() => {
    this.state = "paused";
  });

  resume = vi.fn(() => {
    this.state = "recording";
  });

  constructor(stream: MockMediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm;codecs=opus";
    MockMediaRecorder.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

export class MockAnalyserNode {
  fftSize = 64;
  frequencyBinCount = 32;
  smoothingTimeConstant = 0.8;
  connect = vi.fn();
  disconnect = vi.fn();
  getByteFrequencyData = vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = 90 + ((i * 19) % 140);
    }
  });
  getByteTimeDomainData = vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = 128 + ((i % 2 === 0 ? 1 : -1) * 32);
    }
  });
}

export class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: "running" | "suspended" | "closed" = "running";
  analyser = new MockAnalyserNode();
  source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  createMediaStreamSource = vi.fn(() => this.source);
  createAnalyser = vi.fn(() => this.analyser);
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });

  constructor() {
    MockAudioContext.instances.push(this);
  }
}

export class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;

  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;

  private listeners = new Map<string, Set<Listener>>();

  start = vi.fn(() => {
    const startEvent = new Event("start");
    this.onstart?.(startEvent);
    this.emit("start", startEvent);
  });

  stop = vi.fn(() => {
    const endEvent = new Event("end");
    this.onend?.(endEvent);
    this.emit("end", endEvent);
  });

  abort = vi.fn(() => {
    const endEvent = new Event("end");
    this.onend?.(endEvent);
    this.emit("end", endEvent);
  });

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emitFinalTranscript(transcript: string): void {
    const alternative = { transcript, confidence: 0.98 };
    const resultItem = Object.assign([alternative], {
      isFinal: true,
      item: (index: number) => (index === 0 ? alternative : undefined),
    });
    const resultList = Object.assign([resultItem], {
      item: (index: number) => (index === 0 ? resultItem : undefined),
    });
    const event = Object.assign(new Event("result"), {
      resultIndex: 0,
      results: resultList,
    });
    this.onresult?.(event);
    this.emit("result", event);

    const endEvent = new Event("end");
    this.onend?.(endEvent);
    this.emit("end", endEvent);
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

export class MockSpeechSynthesisUtterance {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;

  private listeners = new Map<string, Set<Listener>>();

  constructor(text = "") {
    this.text = text;
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  finish(): void {
    const endEvent = new Event("end");
    this.onend?.(endEvent);
    for (const listener of this.listeners.get("end") ?? []) {
      listener(endEvent);
    }
  }
}

export class MockAudioElement {
  static instances: MockAudioElement[] = [];

  src: string;
  paused = true;
  currentTime = 0;
  onended: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onpause: ((event: Event) => void) | null = null;

  private listeners = new Map<string, Set<Listener>>();

  play = vi.fn(async () => {
    this.paused = false;
  });

  pause = vi.fn(() => {
    this.paused = true;
    const pauseEvent = new Event("pause");
    this.onpause?.(pauseEvent);
    this.emit("pause", pauseEvent);
  });

  load = vi.fn();

  constructor(src = "") {
    this.src = src;
    MockAudioElement.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  finishPlayback(): void {
    this.paused = true;
    const endedEvent = new Event("ended");
    this.onended?.(endedEvent);
    this.emit("ended", endedEvent);
  }

  failPlayback(): void {
    this.paused = true;
    const errorEvent = new Event("error");
    this.onerror?.(errorEvent);
    this.emit("error", errorEvent);
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

export interface InstalledVoiceMocks {
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  getUserMediaMock: ReturnType<
    typeof vi.fn<(constraints: MediaStreamConstraints) => Promise<MockMediaStream>>
  >;
  createObjectURLMock: ReturnType<typeof vi.fn<(obj: Blob | MediaSource) => string>>;
  revokeObjectURLMock: ReturnType<typeof vi.fn<(url: string) => void>>;
  speechSynthesisMock: {
    speak: ReturnType<typeof vi.fn<(utterance: MockSpeechSynthesisUtterance) => void>>;
    cancel: ReturnType<typeof vi.fn<() => void>>;
    pause: ReturnType<typeof vi.fn<() => void>>;
    resume: ReturnType<typeof vi.fn<() => void>>;
    getVoices: ReturnType<typeof vi.fn<() => SpeechSynthesisVoice[]>>;
    speaking: boolean;
    pending: boolean;
    paused: boolean;
  };
}

export function installVoiceBrowserMocks(options?: {
  mediaRecorderSupported?: boolean;
  mediaDevicesSupported?: boolean;
  speechRecognitionSupported?: boolean;
  webkitSpeechRecognitionOnly?: boolean;
  speechSynthesisSupported?: boolean;
}): InstalledVoiceMocks {
  const {
    mediaRecorderSupported = true,
    mediaDevicesSupported = true,
    speechRecognitionSupported = true,
    webkitSpeechRecognitionOnly = false,
    speechSynthesisSupported = true,
  } = options ?? {};

  MockMediaRecorder.instances = [];
  MockAudioContext.instances = [];
  MockSpeechRecognition.instances = [];
  MockAudioElement.instances = [];

  const fetchMock = vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify({ text: "The client sends SYN first." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const getUserMediaMock = vi.fn<
    (constraints: MediaStreamConstraints) => Promise<MockMediaStream>
  >(async () => new MockMediaStream());

  if (mediaDevicesSupported) {
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      writable: true,
      value: {
        getUserMedia: getUserMediaMock,
      },
    });
  } else {
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  }

  if (mediaRecorderSupported) {
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  } else {
    vi.stubGlobal("MediaRecorder", undefined);
  }

  vi.stubGlobal("AudioContext", MockAudioContext);
  vi.stubGlobal("webkitAudioContext", MockAudioContext);
  vi.stubGlobal("Audio", MockAudioElement);

  if (speechRecognitionSupported) {
    if (webkitSpeechRecognitionOnly) {
      vi.stubGlobal("SpeechRecognition", undefined);
      vi.stubGlobal("webkitSpeechRecognition", MockSpeechRecognition);
    } else {
      vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
      vi.stubGlobal("webkitSpeechRecognition", MockSpeechRecognition);
    }
  } else {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
  }

  const speechSynthesisMock = {
    speak: vi.fn<(utterance: MockSpeechSynthesisUtterance) => void>(() => {}),
    cancel: vi.fn(() => {}),
    pause: vi.fn(() => {}),
    resume: vi.fn(() => {}),
    getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]),
    speaking: false,
    pending: false,
    paused: false,
  };

  if (speechSynthesisSupported) {
    vi.stubGlobal("speechSynthesis", speechSynthesisMock);
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
  } else {
    vi.stubGlobal("speechSynthesis", undefined);
    vi.stubGlobal("SpeechSynthesisUtterance", undefined);
  }

  const createObjectURLMock = vi.fn<(obj: Blob | MediaSource) => string>(
    () => "blob:noggin-voice-test",
  );
  const revokeObjectURLMock = vi.fn<(url: string) => void>(() => {});
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURLMock,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURLMock,
  });

  return {
    fetchMock,
    getUserMediaMock,
    createObjectURLMock,
    revokeObjectURLMock,
    speechSynthesisMock,
  };
}
