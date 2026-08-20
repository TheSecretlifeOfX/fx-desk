import type {
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { OrderBlock } from "@/lib/types";

/**
 * Draws order blocks as real rectangles on the chart.
 *
 * Lightweight Charts has no rectangle shape, so this implements its series
 * primitive interface: on every frame the library hands us a renderer, and we
 * convert each block's price range and origin time into pixel coordinates via
 * the chart's own scales. Because the conversion happens per frame, the zones
 * stay locked to their prices while the user scrolls and zooms — which is the
 * whole point of drawing them this way rather than overlaying a static image.
 *
 * Each zone extends from its origin candle to the right edge, because a zone
 * remains relevant until price reaches it.
 */

type Colours = {
  bull: string;
  bear: string;
};

class Renderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly blocks: OrderBlock[],
    private readonly times: Time[],
    private readonly source: OrderBlockPrimitive,
    private readonly colours: Colours,
  ) {}

  draw(target: {
    useBitmapCoordinateSpace: (
      cb: (scope: {
        context: CanvasRenderingContext2D;
        horizontalPixelRatio: number;
        verticalPixelRatio: number;
        bitmapSize: { width: number; height: number };
      }) => void,
    ) => void;
  }): void {
    const chart = this.source.chart;
    const series = this.source.series;
    if (!chart || !series) return;

    const timeScale = chart.timeScale();

    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr, bitmapSize }) => {
        for (const block of this.blocks) {
          const originTime = this.times[block.index];
          if (originTime === undefined) continue;

          const x = timeScale.timeToCoordinate(originTime);
          const yTop = series.priceToCoordinate(block.top);
          const yBottom = series.priceToCoordinate(block.bottom);
          if (x === null || yTop === null || yBottom === null) continue;

          const left = Math.round(x * hr);
          const right = bitmapSize.width;
          if (right <= left) continue;

          const top = Math.round(yTop * vr);
          const bottom = Math.round(yBottom * vr);
          const height = Math.max(1, bottom - top);

          const colour =
            block.kind === "bullish" ? this.colours.bull : this.colours.bear;

          ctx.save();

          ctx.globalAlpha = block.mitigated ? 0.08 : 0.18;
          ctx.fillStyle = colour;
          ctx.fillRect(left, top, right - left, height);

          ctx.globalAlpha = block.mitigated ? 0.4 : 0.9;
          ctx.strokeStyle = colour;
          ctx.lineWidth = Math.max(1, Math.round(hr));
          if (block.mitigated) ctx.setLineDash([4 * hr, 4 * hr]);

          ctx.beginPath();
          ctx.moveTo(left, top);
          ctx.lineTo(right, top);
          ctx.moveTo(left, bottom);
          ctx.lineTo(right, bottom);
          ctx.stroke();

          // Left edge marks where the zone originated.
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(left, top);
          ctx.lineTo(left, bottom);
          ctx.stroke();

          ctx.restore();
        }
      },
    );
  }
}

class PaneView implements IPrimitivePaneView {
  constructor(private readonly source: OrderBlockPrimitive) {}

  renderer(): IPrimitivePaneRenderer {
    return new Renderer(
      this.source.visibleBlocks,
      this.source.times,
      this.source,
      this.source.colours,
    );
  }
}

export class OrderBlockPrimitive implements ISeriesPrimitive<Time> {
  chart: SeriesAttachedParameter<Time>["chart"] | null = null;
  series: SeriesAttachedParameter<Time>["series"] | null = null;

  private blocks: OrderBlock[] = [];
  private enabled = true;
  private requestUpdate?: () => void;

  times: Time[] = [];

  constructor(readonly colours: Colours) {}

  get visibleBlocks(): OrderBlock[] {
    return this.enabled ? this.blocks : [];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = undefined;
  }

  setData(blocks: OrderBlock[], times: Time[]): void {
    this.blocks = blocks;
    this.times = times;
    this.requestUpdate?.();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.requestUpdate?.();
  }

  paneViews(): IPrimitivePaneView[] {
    return [new PaneView(this)];
  }
}
