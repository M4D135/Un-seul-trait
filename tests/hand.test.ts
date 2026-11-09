import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DrawingHand, DRAWING_HAND_SOURCE} from '../lib/trait/hand';

type Matrix = [number, number, number, number, number, number];
function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}

function handRig(embedded = false) {
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const install = (key: string, value: unknown) => {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  };
  const images: {src: string}[] = [];
  class ReadyImage {
    src=''; decoding=''; complete=true;
    naturalWidth=DRAWING_HAND_SOURCE.width;
    naturalHeight=DRAWING_HAND_SOURCE.height;
    constructor() {images.push(this);}
  }
  install('Image',ReadyImage);
  install('document',{baseURI:'https://game.example/chapter/'});
  install('__TRAIT_HD_HAND_ASSET__',embedded?'data:image/webp;base64,AQIDBA==':undefined);
  let matrix: Matrix=[1,0,0,1,0,0];
  const stack: {matrix: Matrix; alpha: number}[]=[];
  const draws: {tip:{x:number;y:number};width:number;alpha:number;mirrored:boolean}[]=[];
  const context = {
    globalAlpha: .8, imageSmoothingEnabled:false, imageSmoothingQuality:'low',
    save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha});},
    restore(){const state=stack.pop()!;matrix=state.matrix;this.globalAlpha=state.alpha;},
    translate(x:number,y:number){matrix=multiply(matrix,[1,0,0,1,x,y]);},
    rotate(angle:number){matrix=multiply(matrix,[Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0]);},
    scale(x:number,y:number){matrix=multiply(matrix,[x,0,0,y,0,0]);},
    drawImage(_image:unknown,x:number,y:number,width:number,height:number){
      const px=x+DRAWING_HAND_SOURCE.tipX*width/DRAWING_HAND_SOURCE.width;
      const py=y+DRAWING_HAND_SOURCE.tipY*height/DRAWING_HAND_SOURCE.height;
      draws.push({tip:{x:matrix[0]*px+matrix[2]*py+matrix[4],y:matrix[1]*px+matrix[3]*py+matrix[5]},width,alpha:this.globalAlpha,mirrored:matrix[0]*matrix[3]-matrix[1]*matrix[2]<0});
    },
  };
  const hand=new DrawingHand();
  return {
    hand, images, context:context as unknown as CanvasRenderingContext2D, draws,
    cleanup(){
      for(const [key,descriptor] of previous){
        if(descriptor)Object.defineProperty(globalThis,key,descriptor);
        else Reflect.deleteProperty(globalThis,key);
      }
    },
  };
}

test('photographic pencil stays on quick strokes from either entrance side',()=>{
  for(const heroX of [0,1000]){
    const rig=handRig();
    try {
      const points=[{x:300,y:400},{x:415,y:200},{x:370,y:265}];
      for(const tip of points)rig.hand.draw(rig.context,tip,.016,false,{hero:{x:heroX,y:450}});
      assert.equal(rig.draws.length,points.length);
      rig.draws.forEach((draw,i)=>{
        assert(Math.abs(draw.tip.x-points[i].x)<1e-8,'pencil x must not lag behind input');
        assert(Math.abs(draw.tip.y-points[i].y)<1e-8,'pencil y must not lag behind input');
        assert.equal(draw.mirrored,heroX===1000);
        assert(draw.alpha>0&&draw.alpha<=.8,'respect surrounding scene opacity');
      });
      assert.equal(rig.context.globalAlpha,.8,'canvas state restored');
    } finally {rig.cleanup();}
  }
});

test('tall viewports cannot enlarge the hand and the chosen entrance does not flip during a stroke',()=>{
  const rig=handRig();
  try {
    rig.hand.draw(rig.context,{x:300,y:140},.2,true,{bottom:560,hero:{x:0,y:400}});
    rig.hand.draw(rig.context,{x:320,y:140},.2,true,{bottom:1800,hero:{x:1000,y:400}});
    assert.equal(rig.draws[0].width,rig.draws[1].width);
    assert(rig.draws[1].width<=550,'photographic hand must remain proportional to the character');
    assert.equal(rig.draws[0].mirrored,rig.draws[1].mirrored);
  } finally {rig.cleanup();}
});

test('clear and reduced motion remove the hand immediately, with embedded or relative HD asset',()=>{
  for(const embedded of [false,true]){
    const rig=handRig(embedded);
    try {
      assert.equal(rig.images[0].src,embedded?'data:image/webp;base64,AQIDBA==':'https://game.example/chapter/drawing-hand-hd.webp');
      rig.hand.draw(rig.context,{x:300,y:300},.016,true);
      assert.equal(rig.draws.length,1);
      rig.hand.draw(rig.context,null,.016,true);
      assert.equal(rig.draws.length,1,'no retreat animation in reduced motion mode');
      rig.hand.draw(rig.context,{x:300,y:300},.2,false);
      rig.hand.clear();
      rig.hand.draw(rig.context,null,.016,false);
      assert.equal(rig.draws.length,2,'clearing cannot leave a photographic ghost');
    } finally {rig.cleanup();}
  }
});
