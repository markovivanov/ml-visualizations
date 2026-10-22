import test from 'node:test';
import fs from 'node:fs';
import '../math.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/model-data.json',import.meta.url)));
const M=globalThis.ModelMath;
function close(actual,expected,tolerance=1e-8){if(Math.abs(actual-expected)>tolerance)throw new Error(`Expected ${expected}, received ${actual}`);}

test('Fitting reduces squared price error and approaches the CSV least-squares solution',()=>{
  const frames=M.regressionFrames(data.regression.points);
  for(let i=1;i<frames.length;i++)if(frames[i].mse>frames[i-1].mse)throw new Error('Squared error increased');
  const end=M.lineAt(frames,1,data.regression.points);
  close(end.slope,data.regression.reference.slope,.03);
  close(end.intercept,data.regression.reference.intercept,.15);
  close(end.mse,data.regression.reference.mse,.01);
  close(M.lineAt(frames,0,data.regression.points).slope,0);
});
test('Tree routes respect both questions, including integer boundaries',()=>{
  const examples=[[4,1,2],[4,2,3],[5,1,5],[8,8,5],[9,2,6],[16,8,6],[2,1,2]];
  for(const [capacity,bedrooms,leaf] of examples){
    const result=M.treeRoute(data.tree.nodes,{accommodates:capacity,bedrooms});
    if(result.path.at(-1)!==leaf)throw new Error('Wrong tree leaf');
    close(result.price,data.tree.nodes[leaf].price);
    if(result.samples!==data.tree.nodes[leaf].samples)throw new Error('Wrong population count');
  }
});
test('Forest predictions agree with scikit-learn for every capacity and bedroom slider setting',()=>{
  const leaves=data.forest.trees.map(()=>new Set());
  for(const example of data.forest.reference){
    const result=M.forestPrediction(data.forest.trees,example);
    close(result.price,example.price);
    if(result.routes.length!==3)throw new Error('The teaching forest should combine exactly three trees');
    result.routes.forEach((route,index)=>leaves[index].add(route.path.at(-1)));
    if(result.price<Math.min(...result.routes.map(route=>route.price))||result.price>Math.max(...result.routes.map(route=>route.price)))throw new Error('Average fell outside the tree predictions');
  }
  for(const reached of leaves)if(reached.size!==4)throw new Error('A trained forest leaf was never exercised');
});
test('PCA retained variation agrees with scikit-learn, and projection discards only the perpendicular coordinate',()=>{
  const angle=Math.atan2(data.pca.direction[1],data.pca.direction[0]);
  close(M.varianceShare(data.pca.covariance,angle),data.pca.varianceRatio);
  close(M.varianceShare(data.pca.covariance,0),.5);
  for(let i=0;i<90;i++)if(M.varianceShare(data.pca.covariance,angle*i/90)>data.pca.varianceRatio+1e-10)throw new Error('Final direction does not maximize variation');
  for(const point of data.pca.selected){
    const result=M.project(point,angle);
    close(result.x*Math.sin(angle)-result.y*Math.cos(angle),0);
    close((point.x-result.x)*Math.cos(angle)+(point.y-result.y)*Math.sin(angle),0);
  }
});
test('Motion reaches both ends of a multi-segment tree branch',()=>{
  const route=[{x:0,y:0},{x:0,y:10},{x:20,y:10},{x:20,y:20}];
  const first=M.alongPath(route,0),last=M.alongPath(route,1),middle=M.alongPath(route,.5);
  close(first.x,0);close(first.y,0);close(last.x,20);close(last.y,20);close(middle.x,10);close(middle.y,10);
});
