async page => {
 const browser=page.context().browser();
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const sdk=`window.onSpotifyIframeApiReady({createController(target,options,callback){
  const listeners={};let uri=options.uri;let paused=true;
  const iframe=document.createElement('iframe');iframe.title='Spotify test fixture';iframe.src='about:blank';target.replaceWith(iframe);
  const emit=data=>{paused=data.isPaused;listeners.playback_update?.({data:{playingURI:uri,duration:30000,position:1000,...data}});};
  const ready=()=>listeners.ready?.({data:{}});
  const controller={destroy(){iframe.remove();},addListener(name,fn){listeners[name]=fn;},
   togglePlay(){emit({isPaused:!paused,isBuffering:false});},
   loadEntity(next){uri=next;paused=true;setTimeout(ready,0);},loadUri(next){this.loadEntity(next);}};
  window.__fixture={emit,uri:()=>uri};callback(controller);setTimeout(ready,0);
 }});`;
 await context.route('https://open.spotify.com/embed/iframe-api/v1',route=>route.fulfill({contentType:'application/javascript',body:sdk}));
 const p=await context.newPage();await p.goto('http://127.0.0.1:3100/moliang/');
 check(await p.locator('script[src*="spotify"]').count()===0,'no SDK before interaction');
 await p.getByRole('button',{name:'Snooze — SZA',exact:true}).click();
 await p.getByText('点击下方播放器开始聆听',{exact:true}).waitFor();
 check(await p.getByTestId('music-scene').getAttribute('data-playing')==='false','selection does not fake play');
 await p.getByRole('button',{name:'播放音乐',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='true');
 await p.evaluate(()=>window.__fixture.emit({isPaused:false,isBuffering:true}));
 await p.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='false');
 await p.evaluate(()=>window.__fixture.emit({isPaused:false,isBuffering:false}));
 await p.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='true');
 await p.getByRole('button',{name:'暂停音乐',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='false');
 await p.getByRole('button',{name:'播放音乐',exact:true}).click();
 await p.getByRole('button',{name:'下一首',exact:true}).click();
 await p.waitForFunction(()=>window.__fixture.uri().endsWith('1Q7EgiMOuwDcB0PJC6AzON')&&document.querySelector('[data-testid="music-scene"]').dataset.playing==='true');
 await p.getByRole('button',{name:'上一首',exact:true}).click();
 await p.waitForFunction(()=>window.__fixture.uri().endsWith('4iZ4pt7kvcaH6Yo8UoZ4s2'));
 const theme=await p.locator('html').getAttribute('class');await p.getByRole('button',{name:'夜晚',exact:true}).click();
 check(await p.locator('html').getAttribute('class')===theme,'room lighting preserves global theme');
 check(await p.getByTestId('music-scene').getAttribute('data-light')==='night','room light changes');
 await p.setViewportSize({width:390,height:844});
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile embed no overflow');
 await p.getByTestId('music-room').screenshot({path:'.artifacts/music-fixture-mobile.png'});
 await context.close();
 const offline=await browser.newContext();let requests=0;
 await offline.route('https://open.spotify.com/embed/iframe-api/v1',route=>++requests===1?route.abort():route.fulfill({contentType:'application/javascript',body:sdk}));
 const q=await offline.newPage();await q.goto('http://127.0.0.1:3100/moliang/');await q.getByRole('button',{name:'播放音乐',exact:true}).click();
 await q.getByRole('button',{name:'重新连接 Spotify',exact:true}).waitFor();
 check(await q.getByTestId('music-scene').getAttribute('data-playing')==='false','network error stops animation');
 check((await q.getByRole('link',{name:'平台完整版'}).getAttribute('href')).includes('open.spotify.com/track/'),'failure retains platform link');
 await q.getByRole('button',{name:'重新连接 Spotify',exact:true}).click();await q.getByTestId('spotify-embed').locator('iframe').waitFor();
 check(requests===2,'explicit retry reloads failed SDK');await offline.close();
 return ['mocked SDK: lazy load, event-driven animation, buffering, pause, previous/next, autoplay after ready passed','room-only lighting and mobile embed passed','network failure, platform link and successful retry passed'];
}
