export class FollowLatest {
  constructor(container,button,schedule=callback=>{let fired=false;const run=()=>{if(!fired){fired=true;callback();}};requestAnimationFrame(run);setTimeout(run,40);}){
    this.container=container;this.button=button;this.schedule=schedule;this.follow=true;this.pending=false;
    container.addEventListener('scroll',()=>{if(!this.pending)this.follow=this.distance()<64;button.hidden=this.follow;},{passive:true});
    button.onclick=()=>this.jump();
  }
  distance(){const c=this.container;return c.scrollHeight-c.scrollTop-c.clientHeight;}
  jump(){this.follow=true;this.changed();}
  changed(){
    if(this.pending)return;this.pending=true;
    this.schedule(()=>{this.pending=false;if(this.follow){this.container.scrollTop=this.container.scrollHeight;this.button.hidden=true;}else this.button.hidden=this.distance()<64;});
  }
}
