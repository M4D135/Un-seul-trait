type Point = {x: number; y: number};

// Authored photographic image, not footage extracted from the original cartoon.
// The portable build embeds these same WebP bytes; hosting uses a relative URL.
declare const __TRAIT_HD_HAND_ASSET__: string | undefined;

/** Measured in the genuinely transparent 941 × 1672 image. */
export const DRAWING_HAND_SOURCE = {width: 941, height: 1672, tipX: 41, tipY: 226} as const;

export type DrawingHandOptions = {
  mode?: 'draw' | 'point' | 'tap';
  /** Choose the entrance side away from the character without moving the pencil point. */
  hero?: Point;
  /** Visible lower edge. The long forearm avoids enlarging the hand on phones. */
  bottom?: number;
};

/** Photographic hand with a fixed pencil pivot and gently articulated wrist. */
export class DrawingHand {
  private image: HTMLImageElement | null = null;
  private opacity = 0;
  private angle = 0;
  private last: Point | null = null;
  private previous: Point | null = null;
  private leaving = 0;
  private elapsed = 0;
  private side = 1;
  private mode: 'draw' | 'point' | 'tap' = 'draw';

  constructor() {
    if (typeof Image !== 'undefined') {
      this.image = new Image();
      this.image.decoding = 'async';
      this.image.src = typeof __TRAIT_HD_HAND_ASSET__ !== 'undefined'
        ? __TRAIT_HD_HAND_ASSET__
        : new URL('drawing-hand-hd.webp',document.baseURI).href;
    }
  }

  draw(ctx: CanvasRenderingContext2D, tip: Point | null, dt: number, reducedMotion: boolean, options: DrawingHandOptions = {}) {
    dt=Math.max(0,Math.min(.2,Number.isFinite(dt)?dt:0));
    const mode=tip?(options.mode??'draw'):this.mode;
    if (tip) {
      this.mode=mode;
      if (!this.previous) {
        this.side=options.hero&&options.hero.x>tip.x+24?-1:1;
        this.elapsed=0;
        this.angle=0;
        // A new gesture enters at its new point instead of dragging the forearm across the hero.
        if(this.last&&Math.hypot(tip.x-this.last.x,tip.y-this.last.y)>120)this.opacity=0;
      }
      this.elapsed+=dt;
      if (this.previous) {
        const dx = tip.x - this.previous.x, dy = tip.y - this.previous.y;
        const wanted = Math.hypot(dx, dy) > .2
          ? Math.max(-.055, Math.min(.055, Math.atan2(dy, Math.max(6, Math.abs(dx))) * .055))
          : 0;
        this.angle += (wanted - this.angle) * (1 - Math.exp(-dt * 12));
      }
      // Contact uses the actual stroke endpoint. Only the wrist angle is eased.
      this.last = { ...tip };
      this.previous = { ...tip };
      this.leaving = 0;
      this.opacity = reducedMotion ? 1 : Math.min(1, this.opacity + dt * 8);
    } else {
      this.previous = null;
      this.leaving += dt;
      this.opacity = reducedMotion ? 0 : Math.max(0, this.opacity - dt * 4.2);
    }
    if (!this.last || this.opacity <= 0 || !this.image?.complete || !this.image.naturalWidth) return;
    const lift = tip ? 0 : Math.min(1, this.leaving * 4);
    ctx.save();
    ctx.globalAlpha *= this.opacity;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(this.last.x + this.side*lift*60,this.last.y + lift*70);
    const touch=mode==='tap'?Math.sin(Math.min(1,this.elapsed/.32)*Math.PI)*.025:0;
    const arrival=(1-this.opacity)*.035;
    const rotation=.12+(reducedMotion?0:this.angle+lift*.06+arrival+touch);
    ctx.rotate(this.side*rotation);
    ctx.scale(this.side,1);
    // The long source forearm provides the overscan. Scaling by viewport height
    // made the old 304 px film cutout enormous on tall phones.
    const width=mode==='draw'?520:480;
    const magnification=width/DRAWING_HAND_SOURCE.width;
    ctx.drawImage(this.image,-DRAWING_HAND_SOURCE.tipX*magnification,-DRAWING_HAND_SOURCE.tipY*magnification,width,DRAWING_HAND_SOURCE.height*magnification);
    ctx.restore();
  }

  clear() {
    this.last = null;
    this.previous = null;
    this.opacity = 0;
    this.angle = 0;
    this.leaving = 0;
    this.elapsed = 0;
    this.side = 1;
    this.mode = 'draw';
  }
}
