export class FollowLatest {
  constructor(container,button,schedule=callback=>{let fired=false;const run=()=>{if(!fired){fired=true;callback();}};requestAnimationFrame(run);setTimeout(run,40);}){
    this.container=container;this.button=button;this.schedule=schedule;this.follow=true;this.pending=false;
    // Layout/scroll anchoring can dispatch scroll after our scheduled follow.
    // Only user input may turn following off; a delayed layout event must not.
    this.userScrollUntil=0;
    const userScroll=()=>{this.userScrollUntil=Date.now()+1000;this.follow=false;button.hidden=false;};
    container.addEventListener('wheel',event=>{this.userScrollUntil=Date.now()+1000;if(event.deltaY<0)userScroll();},{passive:true});
    for(const event of ['touchmove','pointerdown'])container.addEventListener(event,userScroll,{passive:true});
    container.addEventListener('keydown',event=>{if(['ArrowUp','PageUp','Home',' '].includes(event.key))userScroll();else if(event.key==='End')this.jump();else if(['ArrowDown','PageDown'].includes(event.key)){this.userScrollUntil=Date.now()+1000;if(this.distance()<64){this.follow=true;button.hidden=true;}}});
    container.addEventListener('scroll',()=>{if(!this.pending){if(this.distance()<64)this.follow=true;else if(Date.now()<this.userScrollUntil)this.follow=false;}button.hidden=this.follow;},{passive:true});
    button.onclick=()=>this.jump();
  }
  distance(){const c=this.container;return c.scrollHeight-c.scrollTop-c.clientHeight;}
  jump(){this.userScrollUntil=0;this.follow=true;this.changed();}
  changed(){
    if(this.pending)return;this.pending=true;
    this.schedule(()=>{this.pending=false;if(this.follow){this.container.scrollTop=this.container.scrollHeight;this.button.hidden=true;}else this.button.hidden=this.distance()<64;});
  }
}
