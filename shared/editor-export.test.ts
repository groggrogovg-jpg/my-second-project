import assert from "node:assert/strict";
import test from "node:test";
import {
  downloadEditorPng,
  getEditorSceneAppearance,
} from "./editor-export.ts";

test("export scene keeps a solid background and text and badge colors", () => {
  const scene = getEditorSceneAppearance("color", "#123456", { src: "ignored.png" }, [
    { id: "title", fill: "#fedcba" },
    { id: "badge", fill: "#112233", bgColor: "#abcdef" },
  ]);

  assert.equal(scene.backgroundColor, "#123456");
  assert.equal(scene.backgroundImage, null);
  assert.equal(scene.elements[0].fill, "#fedcba");
  assert.equal(scene.elements[1].fill, "#112233");
  assert.equal(scene.elements[1].bgColor, "#abcdef");
});

test("export scene keeps the uploaded background image", () => {
  const uploadedImage = { src: "data:image/png;base64,custom-background" };
  const scene = getEditorSceneAppearance("image", "#000000", uploadedImage, []);

  assert.equal(scene.backgroundImage, uploadedImage);
});

test("PNG capture excludes the selection transformer and editor UI", () => {
  const events: string[] = [];
  let transformerVisible = true;
  const transformer = {
    isVisible: () => transformerVisible,
    hide: () => {
      transformerVisible = false;
      events.push("hide-transformer");
    },
    show: () => {
      transformerVisible = true;
      events.push("show-transformer");
    },
  };
  const anchor = {
    download: "",
    href: "",
    click: () => events.push("click-download"),
  };
  const stage = {
    currentWidth: 800,
    currentHeight: 800,
    currentScaleX: 0.5,
    currentScaleY: 0.5,
    batchDraw: () => events.push("draw-stage"),
    width(value?: number) {
      if (value !== undefined) this.currentWidth = value;
      return this.currentWidth;
    },
    height(value?: number) {
      if (value !== undefined) this.currentHeight = value;
      return this.currentHeight;
    },
    scaleX(value?: number) {
      if (value !== undefined) this.currentScaleX = value;
      return this.currentScaleX;
    },
    scaleY(value?: number) {
      if (value !== undefined) this.currentScaleY = value;
      return this.currentScaleY;
    },
    toDataURL: ({ pixelRatio }: { pixelRatio: number }) => {
      assert.equal(transformerVisible, false);
      events.push(`capture-${pixelRatio}x`);
      return "data:image/png;base64,exported-stage-only";
    },
  };

  downloadEditorPng(stage, transformer, "card.png", () => anchor);

  assert.deepEqual(events, [
    "hide-transformer",
    "draw-stage",
    "capture-2x",
    "click-download",
    "show-transformer",
    "draw-stage",
  ]);
  assert.equal(anchor.download, "card.png");
  assert.equal(anchor.href, "data:image/png;base64,exported-stage-only");
  assert.equal(transformerVisible, true);
});

test("PNG capture scales the whole scene to the requested format and restores the editor", () => {
  const captures: Array<Record<string, number>> = [];
  const stage = {
    currentWidth: 800,
    currentHeight: 800,
    currentScaleX: 0.75,
    currentScaleY: 0.75,
    batchDraw() {},
    width(value?: number) {
      if (value !== undefined) this.currentWidth = value;
      return this.currentWidth;
    },
    height(value?: number) {
      if (value !== undefined) this.currentHeight = value;
      return this.currentHeight;
    },
    scaleX(value?: number) {
      if (value !== undefined) this.currentScaleX = value;
      return this.currentScaleX;
    },
    scaleY(value?: number) {
      if (value !== undefined) this.currentScaleY = value;
      return this.currentScaleY;
    },
    toDataURL({ pixelRatio }: { pixelRatio: number }) {
      captures.push({
        width: this.currentWidth,
        height: this.currentHeight,
        scaleX: this.currentScaleX,
        scaleY: this.currentScaleY,
        pixelRatio,
      });
      return "data:image/png;base64,formatted";
    },
  };

  downloadEditorPng(
    stage,
    null,
    "portrait.png",
    () => ({ download: "", href: "", click() {} }),
    { width: 900, height: 1200 },
  );

  assert.deepEqual(captures, [{
    width: 900,
    height: 1200,
    scaleX: 1.125,
    scaleY: 1.5,
    pixelRatio: 1,
  }]);
  assert.deepEqual(
    [stage.currentWidth, stage.currentHeight, stage.currentScaleX, stage.currentScaleY],
    [800, 800, 0.75, 0.75],
  );
});