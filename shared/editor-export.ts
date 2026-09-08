export type EditorBackgroundMode = "generated" | "color" | "image";

export interface EditorSceneElement {
  fill?: string;
  bgColor?: string;
}

export function getEditorSceneAppearance<TImage, TElement extends EditorSceneElement>(
  backgroundMode: EditorBackgroundMode,
  backgroundColor: string,
  backgroundImage: TImage | null,
  elements: TElement[],
) {
  return {
    backgroundColor,
    backgroundImage: backgroundMode === "color" ? null : backgroundImage,
    elements: elements.map((element) => ({
      ...element,
      fill: element.fill || "#ffffff",
      bgColor: element.bgColor || null,
    })),
  };
}

interface ExportStage {
  toDataURL(options: { pixelRatio: number }): string;
  batchDraw(): void;
  width(): number;
  width(value: number): void;
  height(): number;
  height(value: number): void;
  scaleX(): number;
  scaleX(value: number): void;
  scaleY(): number;
  scaleY(value: number): void;
}

interface ExportTransformer {
  isVisible(): boolean;
  hide(): void;
  show(): void;
}

interface DownloadAnchor {
  download: string;
  href: string;
  click(): void;
}

export function downloadEditorPng(
  stage: ExportStage,
  transformer: ExportTransformer | null,
  filename: string,
  createAnchor: () => DownloadAnchor,
  outputSize?: { width: number; height: number },
) {
  const restoreTransformer = transformer?.isVisible() ?? false;
  const originalSize = {
    width: stage.width(),
    height: stage.height(),
    scaleX: stage.scaleX(),
    scaleY: stage.scaleY(),
  };
  transformer?.hide();
  if (outputSize) {
    stage.width(outputSize.width);
    stage.height(outputSize.height);
    stage.scaleX(outputSize.width / originalSize.width);
    stage.scaleY(outputSize.height / originalSize.height);
  }
  stage.batchDraw();

  try {
    const anchor = createAnchor();
    anchor.download = filename;
    anchor.href = stage.toDataURL({ pixelRatio: outputSize ? 1 : 2 });
    anchor.click();
  } finally {
    if (outputSize) {
      stage.width(originalSize.width);
      stage.height(originalSize.height);
      stage.scaleX(originalSize.scaleX);
      stage.scaleY(originalSize.scaleY);
    }
    if (restoreTransformer) transformer?.show();
    stage.batchDraw();
  }
}