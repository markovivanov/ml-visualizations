(() => {
  'use strict';
  const M = globalThis.ModelMath;
  const $ = (id) => document.getElementById(id);
  const C = {blue:'#234dde', navy:'#15345c', teal:'#008b80', orange:'#dc742d', ink:'#172e45', muted:'#71808c', line:'#dce3e5'};
  const money = (value, decimals = 0) => '$' + value.toLocaleString('en-US', {minimumFractionDigits:decimals, maximumFractionDigits:decimals});
  const number = (value) => value.toLocaleString('en-US', {maximumFractionDigits:0});
  const frames = M.regressionFrames(MODEL_DATA.regression.points);
  const targetAngle = Math.atan2(MODEL_DATA.pca.direction[1], MODEL_DATA.pca.direction[0]);
  const state = {model:'linear', progress:0, playing:false, speed:1, previousTime:null, request:null, capacity:4, bedrooms:2, guides:true, lastPhase:-1};
  const models = {
    linear: {
      duration:14, kind:'PREDICT A NUMBER', title:'A line learns the price pattern.',
      intro:'Press play to move a flat guess toward a fitted line. Watch the orange price errors get smaller.',
      context:'Six actual listings', legend:[['dot','Listing'],['','Prediction'],['orange','Price error']],
      metricLabel:'Average squared price error', unit:'USD²', metricNote:'Each dollar error is squared, then averaged. Lower is better.',
      steps:['Start with one flat guess','Adjust the line','Reach the fitted line'], jumps:[0,.38,1],
      definition:'Linear regression predicts a number using a weighted formula. With one input, its predictions form a straight line.',
      useCase:'A useful first prediction model when you want to explain how an input contributes to the answer.',
      remember:'A close fit to these six listings does not prove accuracy on new listings. Check predictions on held-out data.',
      note:'Six CSV records from the notebook’s fitting close-up. This small demonstration is separate from the full price model.'
    },
    tree: {
      duration:10, kind:'PREDICT WITH QUESTIONS', title:'A listing takes a path to a price.',
      intro:'Choose a listing, then press play. Follow the orange dot as each answer sends it down a branch.',
      context:'A trained decision tree', legend:[['orange','Selected path'],['','Other branches']],
      metricLabel:'Predicted nightly price', unit:'', metricNote:'A final group’s average training price becomes the prediction.',
      steps:['Answer the first question','Answer the next question','Reach a prediction'], jumps:[0,.48,1],
      definition:'A decision tree follows a sequence of yes/no questions. Each final group supplies a prediction.',
      useCase:'Useful when cutoffs and combinations of inputs matter. Small trees make the prediction rules easy to follow.',
      remember:'This animation follows an already-trained tree. A random forest trains many trees and averages their price predictions.',
      note:'Questions and prices come from the slides’ two-level tree, trained on 1,432 listings. Sliders describe an example to predict.'
    },
    forest: {
      duration:16, kind:'COMBINE SEVERAL TREES', title:'Three trees. One shared prediction.',
      intro:'Choose a listing and press play. Watch three trees make their own price predictions, then average them.',
      context:'A small, trained random forest', legend:[['orange','Listing’s path'],['','Other branches']],
      metricLabel:'Forest’s predicted nightly price', unit:'', metricNote:'Add the three tree predictions and divide by three.',
      steps:['Send the same listing to each tree','Get three price predictions','Average the predictions'], jumps:[0,.67,1],
      definition:'A random forest combines many decision trees. To predict a number, it averages their predictions.',
      useCase:'Useful when prices depend on combinations and cutoffs. Combining varied trees can make predictions more stable than one tree alone.',
      remember:'Averaging does not guarantee a correct price. Check the forest on listings it did not train on.',
      note:'Teaching close-up: 3 shallow trees trained on the same 1,432 CSV listings, using capacity and bedrooms. The notebook’s full model uses 200 trees and three inputs.'
    },
    pca: {
      duration:16, kind:'SUMMARIZE THE INPUTS', title:'Two measurements become one score.',
      intro:'Press play to rotate the axes, project the points, and keep one position for each listing.',
      context:'Capacity + bedrooms, scaled', legend:[['dot','Listing'],['','Direction'],['orange','Projection']],
      metricLabel:'Input variation along the blue direction', unit:'%', metricNote:'Variation in scaled capacity and bedrooms, measured on the training data.',
      steps:['Find the main direction','Project onto that direction','Keep one size score'], jumps:[0,.7,1],
      definition:'PCA creates new summary columns from related numeric inputs. It learns their shared pattern without an outcome to predict.',
      useCase:'Use it to explore related measurements, make simpler plots, or reduce repeated information across columns.',
      remember:'Keeping 94% of input variation is not 94% price accuracy. A size score can hide differences in bedroom layout.',
      note:'PCA learns from the same 1,432 training listings as the slides. Gray points are test listings; six examples make the projection visible.'
    }
  };

  function setText(id, value) { if ($(id).textContent !== value) $(id).textContent = value; }
  function line(x1, y1, x2, y2, attributes = '') { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attributes}/>`; }
  function text(x, y, value, attributes = '') { return `<text x="${x}" y="${y}" ${attributes}>${value}</text>`; }
  function dot(x, y, radius, attributes = '') { return `<circle cx="${x}" cy="${y}" r="${radius}" ${attributes}/>`; }
  function plot(frame) {
    return {x:v=>frame.left + (v-frame.xmin)/(frame.xmax-frame.xmin)*frame.width,
            y:v=>frame.top + frame.height - (v-frame.ymin)/(frame.ymax-frame.ymin)*frame.height};
  }
  function axes(frame, xTicks, yTicks, xLabel, yLabel, dollars = false) {
    const p = plot(frame);
    let out = '';
    for (const v of yTicks) {
      out += line(frame.left,p.y(v),frame.left+frame.width,p.y(v),'class="grid"');
      out += text(frame.left-15,p.y(v)+4,dollars?money(v):v,'class="tick" text-anchor="end"');
    }
    for (const v of xTicks) {
      out += line(p.x(v),frame.top+frame.height,p.x(v),frame.top+frame.height+5,'class="base"');
      out += text(p.x(v),frame.top+frame.height+24,v,'class="tick" text-anchor="middle"');
    }
    out += line(frame.left,frame.top,frame.left,frame.top+frame.height,'class="base"');
    out += line(frame.left,frame.top+frame.height,frame.left+frame.width,frame.top+frame.height,'class="base"');
    out += text(frame.left+frame.width/2,frame.top+frame.height+52,xLabel,'class="axis-label" text-anchor="middle"');
    const tx = frame.left-61, ty = frame.top+frame.height/2;
    out += text(tx,ty,yLabel,`class="axis-label" text-anchor="middle" transform="rotate(-90 ${tx} ${ty})"`);
    return out;
  }

  function renderRegression(progress) {
    const frame = {left:85,top:48,width:655,height:365,xmin:1.5,xmax:10.5,ymin:100,ymax:650};
    const p = plot(frame);
    const fitProgress = Math.pow(M.clamp((progress-.08)/.84), 2.4);
    const fitted = M.lineAt(frames, fitProgress, MODEL_DATA.regression.points);
    const predict = x=>fitted.slope*x+fitted.intercept;
    let out = axes(frame,[2,4,6,8,10],[100,200,300,400,500,600],'Guest capacity','Listed nightly price (USD)',true);
    if (state.guides) {
      for (const point of MODEL_DATA.regression.points) {
        out += line(p.x(point.x),p.y(point.y),p.x(point.x),p.y(predict(point.x)),`stroke="${C.orange}" stroke-width="2"`);
        out += line(p.x(point.x)-4,p.y(predict(point.x)),p.x(point.x)+4,p.y(predict(point.x)),`stroke="${C.orange}" stroke-width="1.5"`);
      }
    }
    out += line(p.x(1.5),p.y(predict(1.5)),p.x(10.5),p.y(predict(10.5)),`stroke="${C.navy}" stroke-width="3.5" stroke-linecap="round"`);
    for (const point of MODEL_DATA.regression.points) {
      out += `<g><title>${point.x} guests: ${money(point.y,2)} recorded nightly price</title>${dot(p.x(point.x),p.y(point.y),6.5,`fill="${C.teal}" stroke="white" stroke-width="2"`)}</g>`;
    }
    out += text(740,25,`Prediction = ${money(fitted.slope,2)} × capacity + ${money(fitted.intercept,2)}`,'class="plot-note" text-anchor="end"');
    out += text(412,495,state.guides?'Orange segments show how many dollars each prediction is off.':'The teal points stay fixed. Only the prediction line moves.','class="plot-note" text-anchor="middle"');
    const phase = progress < .1 ? 0 : progress < .92 ? 1 : 2;
    const copy = [
      'Here we start at about $343 for every listing. The orange segments connect that guess to each recorded price.',
      'Here we see the line tilt as fitting reduces the squared price errors. The listings stay in place; the predictions change.',
      'Here we reach the fitted line for these six listings. The orange errors are much smaller, but most predictions still miss the recorded price.'
    ][phase];
    return {svg:out, phase, copy, metric:number(fitted.mse), title:'Linear regression fitting a line to six listing prices', description:copy};
  }

  const positions = {0:{x:400,y:85,w:224,h:78},1:{x:220,y:245,w:210,h:76},4:{x:580,y:245,w:210,h:76},2:{x:115,y:418,w:160,h:76},3:{x:305,y:418,w:160,h:76},5:{x:495,y:418,w:160,h:76},6:{x:685,y:418,w:160,h:76}};
  function edgePoints(fromId, toId) {
    const a=positions[fromId], b=positions[toId];
    const y1=a.y+a.h/2, y2=b.y-b.h/2, middle=(y1+y2)/2;
    return [{x:a.x,y:y1},{x:a.x,y:middle},{x:b.x,y:middle},{x:b.x,y:y2}];
  }
  const pathD = points=>points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');
  function renderTree(progress) {
    const nodes=MODEL_DATA.tree.nodes;
    const route=M.treeRoute(nodes,{accommodates:state.capacity,bedrooms:state.bedrooms});
    const first=M.clamp((progress-.17)/.24), second=M.clamp((progress-.58)/.24);
    const phase=progress < .43 ? 0 : progress < .84 ? 1 : 2;
    const reached=new Set([route.path[0],...(progress>=.41?[route.path[1]]:[]),...(progress>=.82?[route.path[2]]:[])]);
    let out='';
    for(const node of nodes.filter(n=>n.left!==-1)) {
      for(const [child,yes] of [[node.left,true],[node.right,false]]) {
        const points=edgePoints(node.id,child);
        out+=`<path d="${pathD(points)}" fill="none" stroke="#cbd5dc" stroke-width="2"/>`;
        const isFirst=node.id===route.path[0]&&child===route.path[1];
        const isSecond=node.id===route.path[1]&&child===route.path[2];
        const fraction=isFirst?first:isSecond?second:0;
        if(fraction>0)out+=`<path d="${pathD(points)}" fill="none" stroke="${C.orange}" stroke-width="4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1-fraction}"/>`;
        const a=positions[node.id],b=positions[child];
        out+=text((a.x+b.x)/2,points[1].y-13,yes?'Yes':'No',`class="branch-label" text-anchor="middle" font-size="14" fill="${fraction>0?C.orange:C.muted}" font-weight="${fraction>0?650:400}"`);
      }
    }
    for(const node of nodes) {
      const p=positions[node.id], active=reached.has(node.id), leaf=node.left===-1;
      out+=`<g><rect x="${p.x-p.w/2}" y="${p.y-p.h/2}" width="${p.w}" height="${p.h}" rx="8" fill="${active?C.navy:'#f8fafb'}" stroke="${active?C.navy:'#dce3e5'}" stroke-width="1.2"/>`;
      const title=leaf?money(node.price):node.feature==='bedrooms'?'Bedrooms ≤ 1?':node.id===0?'Capacity ≤ 4?':'Capacity ≤ 8?';
      out+=text(p.x,p.y+(leaf?-3:-4),title,`class="node-title" text-anchor="middle" font-size="${leaf?25:20}" font-weight="600" fill="${active?'white':C.ink}"`);
      out+=text(p.x,p.y+20,leaf?`${node.samples} training listings`:'Yes: left · No: right',`class="node-detail" text-anchor="middle" font-size="11" fill="${active?'#c0d1e1':C.muted}"`);
      out+='</g>';
    }
    if(first>0&&first<1) {const p=M.alongPath(edgePoints(route.path[0],route.path[1]),first);out+=dot(p.x,p.y,8,`fill="${C.orange}" stroke="white" stroke-width="3"`);}
    if(second>0&&second<1) {const p=M.alongPath(edgePoints(route.path[1],route.path[2]),second);out+=dot(p.x,p.y,8,`fill="${C.orange}" stroke="white" stroke-width="3"`);}
    out+=text(400,20,`YOUR LISTING: ${state.capacity} GUESTS · ${state.bedrooms} ${state.bedrooms===1?'BEDROOM':'BEDROOMS'}`,`class="tree-input" text-anchor="middle" font-size="12" letter-spacing="1.4" fill="${C.muted}"`);
    out+=text(400,498,'Each final price is the average of the training listings in that group.','class="plot-note" text-anchor="middle"');
    const question=nodes[route.path[1]].feature==='bedrooms'?`This listing has ${state.bedrooms} ${state.bedrooms===1?'bedroom':'bedrooms'}. Is that one or fewer?`:`This listing holds ${state.capacity} guests. Is that eight or fewer?`;
    const copy=phase===0?`Here we ask whether capacity for ${state.capacity} is four or fewer. ${route.answers[0]?'Yes, so this listing goes left.':'No, so this listing goes right.'}`:
      phase===1?`Here we ask the next question. ${question} ${route.answers[1]?'Yes: follow the left branch.':'No: follow the right branch.'}`:
      `Here we reach ${route.samples} training listings with an average price of ${money(route.price)} per night. That average becomes this listing’s prediction.`;
    return {svg:out,phase,copy,metric:phase===2?money(route.price):'—',title:'Decision tree with an animated path for the selected listing',description:copy};
  }

  function renderForest(progress) {
    const prediction=M.forestPrediction(MODEL_DATA.forest.trees,{accommodates:state.capacity,bedrooms:state.bedrooms}); // Use the trained trees' real leaf prices.
    const phase=progress<.22?0:progress<.72?1:2; // Explain the input, individual answers, and average in order.
    const centers=[138,400,662]; // Give each tree an equal-width column.
    const arrival=M.clamp((progress-.03)/.17); // Move copies of the same listing into all three trees.
    const first=M.clamp((progress-.24)/.17), second=M.clamp((progress-.44)/.17); // Trace the two decisions.
    const combine=M.clamp((progress-.74)/.18); // Carry all three prices to the final average.
    const ready=progress>=.94; // Reveal the average only after all three prices arrive.
    let out='';
    const strokePath=(points,fraction,color=C.orange,width=3)=>`<path d="${pathD(points)}" fill="none" stroke="${color}" stroke-width="${width}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1-fraction}"/>`; // Draw a partial route.
    const movingDot=(points,fraction)=>{const p=M.alongPath(points,fraction);return dot(p.x,p.y,6,`fill="${C.orange}" stroke="white" stroke-width="2"`);}; // Place the moving listing on its route.
    for(const [treeIndex,nodes] of MODEL_DATA.forest.trees.entries()) {
      const cx=centers[treeIndex], route=prediction.routes[treeIndex]; // Keep the same listing but follow this tree's questions.
      const layout={0:{x:cx,y:146,w:146},1:{x:cx-59,y:222,w:110},4:{x:cx+59,y:222,w:110},2:{x:cx-93,y:296,w:58},3:{x:cx-31,y:296,w:58},5:{x:cx+31,y:296,w:58},6:{x:cx+93,y:296,w:58}}; // Lay out a full two-level tree.
      const edge=(from,to)=>{const a=layout[from],b=layout[to],middle=(a.y+b.y)/2;return [{x:a.x,y:a.y+17},{x:a.x,y:middle},{x:b.x,y:middle},{x:b.x,y:b.y-17}];}; // Connect a question to an answer branch.
      const inputPath=[{x:400,y:54},{x:400,y:72},{x:cx,y:72},{x:cx,y:129}]; // Send a copy of the listing to each root.
      out+=`<rect x="${cx-124}" y="86" width="248" height="300" rx="10" fill="#f8fafb" stroke="${C.line}"/>`;
      out+=strokePath(inputPath,1,C.line,2)+strokePath(inputPath,arrival); // Show the fan-out from one listing.
      if(arrival>0&&arrival<1)out+=movingDot(inputPath,arrival);
      out+=text(cx-109,108,`TREE ${treeIndex+1}`,`class="forest-tree-name" font-size="12" font-weight="650" letter-spacing="1" fill="${C.muted}"`);
      for(const node of nodes.filter(node=>node.left!==-1)) {
        for(const child of [node.left,node.right]) {
          const path=edge(node.id,child); // Draw every possible branch before highlighting the chosen one.
          const fraction=node.id===route.path[0]&&child===route.path[1]?first:node.id===route.path[1]&&child===route.path[2]?second:0;
          out+=strokePath(path,1,'#cbd5dc',1.5);
          if(fraction>0)out+=strokePath(path,fraction);
        }
      }
      for(const node of nodes) {
        const p=layout[node.id],leaf=node.left===-1; // Leaves hold predicted prices; other nodes hold questions.
        const active=node.id===route.path[0]&&arrival===1||node.id===route.path[1]&&first===1||node.id===route.path[2]&&second===1;
        const label=leaf?money(node.price):`${node.feature==='bedrooms'?'Bedrooms':'Guests'} ≤ ${Math.floor(node.threshold)}?`; // Inputs are integers, so show easy whole-number cutoffs.
        out+=`<g><title>${leaf?`Leaf prediction: ${money(node.price,2)} per night`:`${node.feature==='bedrooms'?'Bedrooms':'Guest capacity'}: ${label}`}</title><rect x="${p.x-p.w/2}" y="${p.y-17}" width="${p.w}" height="34" rx="5" fill="${active?C.navy:'white'}" stroke="${active?C.navy:C.line}"/>`;
        out+=text(p.x,p.y+5,label,`class="forest-node" text-anchor="middle" font-size="${leaf?12:15}" font-weight="${active?600:400}" fill="${active?'white':C.ink}"`);
        out+='</g>';
      }
      out+=text(cx-32,184,'Yes',`text-anchor="middle" font-size="11" fill="${C.muted}"`)+text(cx+32,184,'No',`text-anchor="middle" font-size="11" fill="${C.muted}"`);
      if(first>0&&first<1)out+=movingDot(edge(route.path[0],route.path[1]),first);
      if(second>0&&second<1)out+=movingDot(edge(route.path[1],route.path[2]),second);
      if(second===1)out+=line(layout[route.path[2]].x,313,cx,333,`stroke="${C.orange}" stroke-width="2"`); // Bring the reached leaf's price into the tree's answer box.
      out+=text(cx,362,second===1?money(route.price,2):'—',`class="forest-price" text-anchor="middle" font-size="25" font-weight="600" fill="${second===1?C.navy:C.muted}"`);
      const averagePath=[{x:cx,y:386},{x:cx,y:410},{x:400,y:410},{x:400,y:433}]; // Join the three answers at one average.
      out+=strokePath(averagePath,1,C.line,2);
      if(combine>0)out+=strokePath(averagePath,combine);
      if(combine>0&&combine<1)out+=movingDot(averagePath,combine);
    }
    out+=`<rect x="222" y="14" width="356" height="40" rx="20" fill="${C.navy}"/>`; // Keep the listing's inputs visible above all three trees.
    out+=text(400,40,`SAME LISTING: ${state.capacity} guests · ${state.bedrooms} bedrooms`,`class="forest-input" text-anchor="middle" font-size="16" fill="white"`);
    out+=`<rect x="245" y="433" width="310" height="42" rx="8" fill="${ready?C.blue:'#edf1fa'}"/>`;
    out+=text(400,460,ready?`Forest average: ${money(prediction.price,2)}`:'Combine the three prices',`class="forest-average" text-anchor="middle" font-size="20" font-weight="600" fill="${ready?'white':C.muted}"`);
    out+=text(400,505,ready?`(${prediction.routes.map(route=>money(route.price,2)).join(' + ')}) ÷ 3 ≈ ${money(prediction.price,2)}`:'At each question: Yes → left · No → right.',`class="forest-caption" text-anchor="middle" font-size="13" fill="${C.muted}"`);
    const prices=prediction.routes.map(route=>money(route.price,2)); // Name the measured quantity in each explanation.
    const copy=[
      'Here the same listing goes to all three trees. During training, each tree saw a different sample of the listings and random choices of inputs to try.',
      `Here the trees ask different questions about the same listing. They predict ${prices[0]}, ${prices[1]}, and ${prices[2]} per night. Different trees can give different answers.`,
      `Here we add the three predicted nightly prices and divide by 3. The forest predicts about ${money(prediction.price,2)} per night. Every tree gets an equal say.`
    ][phase];
    return {svg:out,phase,copy,metric:ready?money(prediction.price,2):'—',title:'Random forest sending one listing through three trained trees and averaging their prices',description:copy};
  }

  function renderPca(progress) {
    // A square plot gives equal on-screen lengths to one unit on either scaled input axis.
    const frame={left:220,top:28,width:365,height:365,xmin:-2,xmax:5,ymin:-2,ymax:5};
    const p=plot(frame);
    const turn=M.ease((progress-.04)/.49);
    const angle=targetAngle*turn;
    const projectionProgress=M.ease((progress-.57)/.22);
    const stripProgress=M.ease((progress-.83)/.17);
    const phase=progress<.57?0:progress<.83?1:2;
    const share=M.varianceShare(MODEL_DATA.pca.covariance,angle);
    let out=axes(frame,[-2,0,2,4],[-2,0,2,4],'Capacity, scaled','Bedrooms, scaled');
    out+=`<defs><clipPath id="pca-clip"><rect x="${frame.left}" y="${frame.top}" width="${frame.width}" height="${frame.height}"/></clipPath></defs><g clip-path="url(#pca-clip)">`;
    for(const point of MODEL_DATA.pca.points)out+=dot(p.x(point.x),p.y(point.y),2.8,`fill="#94a6b4" opacity="${.32*(1-projectionProgress*.8)}"`);
    const dx=Math.cos(angle)*12,dy=Math.sin(angle)*12;
    out+=line(p.x(-dx),p.y(-dy),p.x(dx),p.y(dy),`stroke="${C.navy}" stroke-width="3"`);
    out+=line(p.x(-dy),p.y(dx),p.x(dy),p.y(-dx),`stroke="${C.orange}" stroke-width="2" opacity="${.6*(1-projectionProgress)}"`);
    for(const point of MODEL_DATA.pca.selected) {
      const projected=M.project(point,targetAngle);
      if(state.guides&&projectionProgress>0)out+=line(p.x(point.x),p.y(point.y),p.x(M.lerp(point.x,projected.x,projectionProgress)),p.y(M.lerp(point.y,projected.y,projectionProgress)),`stroke="${C.orange}" stroke-width="1.7"`);
      out+=dot(p.x(point.x),p.y(point.y),5.5,`fill="${C.teal}" opacity="${1-projectionProgress*.45}"`);
      if(projectionProgress>0)out+=dot(p.x(M.lerp(point.x,projected.x,projectionProgress)),p.y(M.lerp(point.y,projected.y,projectionProgress)),5,`fill="${C.orange}" opacity="${projectionProgress}"`);
    }
    out+='</g>';
    out+=text(725,55,`${Math.round(angle*180/Math.PI)}°`, `class="angle-label" text-anchor="end" font-size="28" font-weight="500" fill="${C.navy}"`);
    out+=text(725,78,phase===0?'direction angle':'PC1 direction','class="plot-note" text-anchor="end"');
    if(stripProgress>0) {
      const sx=score=>125+(score+2)/7*550;
      out+=`<g opacity="${stripProgress}">${line(125,476,675,476,`stroke="${C.navy}" stroke-width="2"`)}${text(125,506,'Smaller','class="plot-note"')}${text(400,506,'PC1 size score','class="plot-note" text-anchor="middle"')}${text(675,506,'Larger','class="plot-note" text-anchor="end"')}</g>`;
      for(const point of MODEL_DATA.pca.selected) {
        const projected=M.project(point,targetAngle);
        const x=M.lerp(p.x(projected.x),sx(projected.score),stripProgress);
        const y=M.lerp(p.y(projected.y),476,stripProgress);
        out+=dot(x,y,6,`fill="${C.orange}" stroke="white" stroke-width="1.5"`);
      }
    } else out+=text(400,486,phase===0?'The blue direction turns toward the largest spread.':'The orange points slide onto the blue direction.','class="plot-note" text-anchor="middle"');
    const copy=[
      'Here the blue direction rotates toward the shared size pattern. The percentage rises as that direction captures more variation in capacity and bedrooms.',
      'Here each highlighted listing slides onto PC1. The orange segment shows the capacity-and-bedroom detail that one size score leaves out.',
      'Here each listing keeps one position on the size axis. PC1 retains about 94% of input variation; the remaining 6% includes differences in bedroom layout.'
    ][phase];
    return {svg:out,phase,copy,metric:(100*share).toFixed(1),title:'PCA rotating axes and projecting listing measurements onto one component',description:copy};
  }

  function render() {
    const info=models[state.model];
    const scene=({linear:renderRegression,tree:renderTree,forest:renderForest,pca:renderPca})[state.model](state.progress);
    $('chart').innerHTML=`<title id="chart-title">${scene.title}</title><desc id="chart-description">${scene.description}</desc>${scene.svg}`;
    setText('metric-value',scene.metric);
    if(state.lastPhase!==scene.phase) {
      setText('explanation',scene.copy);
      $('steps').querySelectorAll('button').forEach((button,index)=>{
        button.classList.toggle('active',index===scene.phase);
        button.classList.toggle('done',index<scene.phase);
        if(index===scene.phase)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      });
      state.lastPhase=scene.phase;
    }
    $('progress').value=Math.round(state.progress*1000);
    $('progress').setAttribute('aria-valuetext',`${Math.round(state.progress*100)} percent, ${info.steps[scene.phase]}`);
    const seconds=Math.min(info.duration,Math.floor(state.progress*info.duration));
    setText('elapsed',`0:${String(seconds).padStart(2,'0')} / 0:${info.duration}`);
    setText('play-label',state.playing?'Pause':state.progress>=1?'Replay':'Play');
    setText('play-icon',state.playing?'Ⅱ':state.progress>=1?'↺':'▶');
    $('play').setAttribute('aria-label',`${state.playing?'Pause':state.progress>=1?'Replay':'Play'} ${{linear:'linear regression',tree:'decision tree',forest:'random forest',pca:'PCA'}[state.model]} animation`);
  }

  function pause() {
    state.playing=false;
    state.previousTime=null;
    if(state.request!==null)cancelAnimationFrame(state.request);
    state.request=null;
  }
  function seek(progress) {pause();state.progress=M.clamp(progress);render();}
  function tick(time) {
    if(!state.playing)return;
    if(state.previousTime!==null)state.progress=M.clamp(state.progress+Math.min((time-state.previousTime)/1000,.1)*state.speed/models[state.model].duration);
    state.previousTime=time;
    if(state.progress>=1)pause();
    render();
    if(state.playing)state.request=requestAnimationFrame(tick);
  }
  function play() {
    if(state.playing){pause();render();return;}
    if(state.progress>=1)state.progress=0;
    state.playing=true;state.previousTime=null;
    render();state.request=requestAnimationFrame(tick);
  }
  function chooseModel(model) {
    pause();state.model=model;state.progress=0;state.lastPhase=-1;state.guides=true;
    const info=models[model];
    document.querySelectorAll('[data-model]').forEach(button=>{
      const active=button.dataset.model===model;
      button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    });
    $('lab').setAttribute('aria-labelledby',`tab-${model}`);
    $('chart').classList.toggle('forest-chart',model==='forest');
    for(const [id,key] of Object.entries({'model-kind':'kind','lesson-title':'title','lesson-intro':'intro','chart-context':'context','metric-label':'metricLabel','metric-unit':'unit','metric-note':'metricNote','definition':'definition','use-case':'useCase','remember':'remember','data-note':'note'}))setText(id,info[key]);
    $('legend').innerHTML=info.legend.map(([style,label])=>`<span><i class="${style}" aria-hidden="true"></i>${label}</span>`).join('');
    $('steps').innerHTML=info.steps.map((label,index)=>`<button type="button" data-jump="${info.jumps[index]}" aria-label="Jump to: ${label}"><span class="step-dot" aria-hidden="true"></span>${label}</button>`).join('');
    $('steps').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>seek(Number(button.dataset.jump))));
    if(model==='tree'||model==='forest') {
      $('model-controls').innerHTML=`<div class="input-row"><label for="capacity">Guest capacity <output id="capacity-value" for="capacity">${state.capacity}</output></label><input id="capacity" type="range" min="2" max="16" step="1" value="${state.capacity}"></div><div class="input-row"><label for="bedrooms">Bedrooms <output id="bedrooms-value" for="bedrooms">${state.bedrooms}</output></label><input id="bedrooms" type="range" min="1" max="8" step="1" value="${state.bedrooms}"></div>`;
      for(const key of ['capacity','bedrooms'])$(key).addEventListener('input',event=>{
        state[key]=Number(event.target.value);setText(`${key}-value`,String(state[key]));state.lastPhase=-1;seek(0);
      });
    } else {
      $('model-controls').innerHTML=`<label class="check-label"><input id="guides" type="checkbox" checked> ${model==='linear'?'Show price errors':'Show projection lines'}</label>`;
      $('guides').addEventListener('change',event=>{state.guides=event.target.checked;render();});
    }
    render();
  }

  $('play').addEventListener('click',play);
  $('reset').addEventListener('click',()=>seek(0));
  $('progress').addEventListener('input',event=>seek(Number(event.target.value)/1000));
  $('speed').addEventListener('change',event=>{state.speed=Number(event.target.value);});
  const tabs=[...document.querySelectorAll('[data-model]')];
  tabs.forEach((button,index)=>{
    button.addEventListener('click',()=>chooseModel(button.dataset.model));
    button.addEventListener('keydown',event=>{
      let target;
      if(event.key==='ArrowRight')target=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')target=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')target=0;
      if(event.key==='End')target=tabs.length-1;
      if(target!==undefined){event.preventDefault();tabs[target].focus();chooseModel(tabs[target].dataset.model);}
    });
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing){pause();render();}});
  chooseModel('linear');
})();
