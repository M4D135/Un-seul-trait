type Point = {x: number; y: number};

// Four photographed frames from the original film. See the public provenance manifest.
// The portable build embeds the same WebP bytes; ordinary hosting uses a relative URL.
declare const __TRAIT_ORIGINAL_HAND_ASSET__: string | undefined;

export type DrawingHandOptions = {
  mode?: 'draw' | 'point' | 'tap';
  /** Choose the entrance side away from the character without moving the pencil point. */
  hero?: Point;
  /** World-space lower edge, so the photographed wrist always exits the frame. */
  bottom?: number;
};

/** Original photographed hand, with its pencil point locked to the player's stroke. */
export class DrawingHand {
  private image: HTMLImageElement | null = null;
  private opacity = 0;
  private angle = 0;
  private last: Point | null = null;
  private previous: Point | null = null;
  private leaving = 0;
  private elapsed = 0;
  private filmTime = 0;
  private side = 1;
  private mode: 'draw' | 'point' | 'tap' = 'draw';

  constructor() {
    if (typeof Image !== 'undefined') {
      this.image = new Image();
      this.image.decoding = 'async';
      this.image.src = typeof __TRAIT_ORIGINAL_HAND_ASSET__ !== 'undefined'
        ? __TRAIT_ORIGINAL_HAND_ASSET__
        : new URL('original-hand-atlas.webp',document.baseURI).href;
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
        // A new gesture enters at its new point instead of dragging the forearm across the hero.
        if(this.last&&Math.hypot(tip.x-this.last.x,tip.y-this.last.y)>120)this.opacity=0;
      }
      this.elapsed+=dt;
      if (this.previous) {
        const dx = tip.x - this.previous.x, dy = tip.y - this.previous.y;
        if (Math.hypot(dx, dy) > .2) {
          this.filmTime += dt;
          const wanted = Math.max(-.055, Math.min(.055, Math.atan2(dy, Math.max(6, Math.abs(dx))) * .055));
          this.angle += (wanted - this.angle) * Math.min(1, dt * 14);
        }
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
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.last.x + this.side*lift*82,this.last.y + lift*52);
    const touch=mode==='tap'?Math.sin(Math.min(1,this.elapsed/.32)*Math.PI)*.045:0;
    const arrival=(1-this.opacity)*.045;
    const rotation=.2+(reducedMotion?0:this.angle+lift*.08+arrival+touch);
    ctx.rotate(this.side*rotation);
    ctx.scale(this.side,1);
    // These are the earliest source-frame cut edges across all four poses,
    // relative to the measured (16,16) pencil tip. Mirroring leaves their y
    // projection unchanged. Scale only as far as necessary to hide those cuts.
    const cutDepth=Math.min(...[[272,224],[110,240],[268,224],[125,256]].map(([x,y])=>x*Math.sin(rotation)+y*Math.cos(rotation)));
    const needed=(options.bottom??this.last.y+340)-this.last.y+24;
    const magnification=Math.max((mode==='draw'?560:500)/304,needed/cutDepth);
    const size=304*magnification;
    const order=[0,1,2,3,2,1];
    const frame=reducedMotion?0:order[Math.floor(this.filmTime*25)%order.length];
    ctx.drawImage(this.image,frame*304,0,304,304,-16*magnification,-16*magnification,size,size);
    ctx.restore();
  }

  clear() {
    this.last = null;
    this.previous = null;
    this.opacity = 0;
    this.angle = 0;
    this.leaving = 0;
    this.elapsed = 0;
    this.filmTime = 0;
    this.side = 1;
    this.mode = 'draw';
  }
}
