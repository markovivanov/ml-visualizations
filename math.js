/* Small, explicit calculations used by the animated explanations. No network or libraries. */
globalThis.ModelMath = (() => {
  const clamp = (x, low = 0, high = 1) => Math.min(high, Math.max(low, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { const u = clamp(t); return u * u * (3 - 2 * u); };
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

  function regressionFrames(points, count = 50) {
    // Centering capacity lets the line rotate around the data's average position.
    const xMean = mean(points.map(p => p.x));
    const yMean = mean(points.map(p => p.y));
    const xScale = Math.sqrt(mean(points.map(p => (p.x - xMean) ** 2)));
    let weight = 0;
    const frames = [];
    for (let step = 0; step <= count; step++) {
      const slope = weight / xScale;
      const intercept = yMean - slope * xMean;
      const mse = mean(points.map(p => (slope * p.x + intercept - p.y) ** 2));
      frames.push({slope, intercept, mse, step});
      // This is a real gradient-descent update for mean squared error, not a random line motion.
      const gradient = 2 * mean(points.map(p => ((p.x - xMean) / xScale) * (slope * p.x + intercept - p.y)));
      weight -= .07 * gradient;
    }
    return frames;
  }

  function lineAt(frames, progress, points) {
    const position = clamp(progress) * (frames.length - 1);
    const left = Math.floor(position);
    const right = Math.min(frames.length - 1, left + 1);
    const slope = lerp(frames[left].slope, frames[right].slope, position - left);
    const intercept = lerp(frames[left].intercept, frames[right].intercept, position - left);
    return {slope, intercept, step: Math.floor(position), mse: mean(points.map(p => (slope * p.x + intercept - p.y) ** 2))};
  }

  function treeRoute(nodes, inputs) {
    const path = [0];
    const answers = [];
    let node = nodes[0];
    while (node.left !== -1) {
      const yes = inputs[node.feature] <= node.threshold;
      answers.push(yes);
      node = nodes[yes ? node.left : node.right];
      path.push(node.id);
    }
    return {path, answers, price: node.price, samples: node.samples};
  }

  function varianceShare(covariance, angle) {
    const x = Math.cos(angle), y = Math.sin(angle);
    return (x * x * covariance[0][0] + 2 * x * y * covariance[0][1] + y * y * covariance[1][1]) /
      (covariance[0][0] + covariance[1][1]);
  }

  function forestPrediction(trees, inputs) {
    const routes = trees.map(nodes => treeRoute(nodes, inputs)); // Send the same listing through every tree.
    return {routes, price: mean(routes.map(route => route.price))}; // Average the original, unrounded prices.
  }

  function project(point, angle) {
    const x = Math.cos(angle), y = Math.sin(angle);
    const score = point.x * x + point.y * y;
    return {x: score * x, y: score * y, score};
  }

  function alongPath(points, progress) {
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let distance = clamp(progress) * lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i] || i === lengths.length - 1) {
        return {x: lerp(points[i].x, points[i + 1].x, distance / lengths[i]), y: lerp(points[i].y, points[i + 1].y, distance / lengths[i])};
      }
      distance -= lengths[i];
    }
    return points[0];
  }

  return {clamp, lerp, ease, mean, regressionFrames, lineAt, treeRoute, forestPrediction, varianceShare, project, alongPath};
})();
