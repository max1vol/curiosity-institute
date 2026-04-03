declare module "@mkkellogg/gaussian-splats-3d" {
  export const RenderMode: {
    Always: number;
    OnChange: number;
    Never: number;
  };

  export class Viewer {
    constructor(options?: {
      selfDrivenMode?: boolean;
      renderer?: import("three").WebGLRenderer;
      camera?: import("three").Camera;
      useBuiltInControls?: boolean;
      ignoreDevicePixelRatio?: boolean;
      gpuAcceleratedSort?: boolean;
      sharedMemoryForWorkers?: boolean;
      dynamicScene?: boolean;
      renderMode?: number;
      antialiased?: boolean;
    });

    addSplatScene(
      path: string,
      options?: {
        showLoadingUI?: boolean;
        progressiveLoad?: boolean;
        splatAlphaRemovalThreshold?: number;
      },
    ): Promise<unknown>;

    update(): void;
    render(): void;
    dispose(): Promise<void>;
  }
}
