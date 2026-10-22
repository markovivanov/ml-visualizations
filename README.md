# Carless model lab

Open [index.html](index.html) in a browser. All website files live directly at the repository root and work offline or on GitHub Pages. No build, installation, or server-side code is required to serve the site.

Choose a model and press **Play**. Pause, replay, change the speed, drag the timeline, or click a named step to stop at a teaching moment.

- **Linear regression:** watch a flat price prediction move toward a fitted line while the squared price error falls. The six actual listings match the notebook’s fitting close-up.
- **Decision tree:** change guest capacity and bedrooms, then follow a listing through the trained tree to its nightly-price prediction. The orange dot and highlighted branches show each decision.
- **Random forest:** send the same listing through three different trees, watch their price predictions emerge, and combine the answers into an average. The inputs change all three routes and the resulting forest prediction.
- **PCA:** watch the main direction rotate into place, project listings onto it, and keep one size score per listing. The percentage measures input variation retained, not prediction accuracy.

The examples use the existing [Denver classroom CSV](../data/denver/denver_listings.csv). The tree and PCA match the training split and model settings in the class slides and notebook. The forest animation uses the same training rows with three shallow trees and two inputs so all the branches fit on screen; the notebook’s full forest uses 200 trees and three inputs. Each teaching tree uses bootstrap sampling and a random choice of one input at each split. See the in-page data disclosure and [class data notes](../data/denver/DATA_NOTES.md) for attribution.

## Edit the site

Edit these files directly at the repository root:

- `index.html`: the page and player controls.
- `styles.css`: layout and colors.
- `app.js`: the four animations and their explanations.
- `math.js`: model calculations.
- `model-data.js`: numeric model inputs loaded by the browser.

Changes to HTML, CSS, and JavaScript take effect as soon as the browser reloads. The `src` directory has been removed.

If you change `data/model-data.json`, refresh the browser's data file with:

```sh
python3 scripts/build.py
```

This optional script uses only the Python standard library. It updates `model-data.js` and creates a standalone `dist/index.html` with everything embedded for older local links and single-file distribution. It does not overwrite the editable root HTML. To recreate the numeric model inputs from the classroom CSV, run `scripts/prepare_data.py` with the class Python environment containing pandas, NumPy, and scikit-learn, then run the script above.

## GitHub Pages setup

The ready-to-serve files are `index.html`, `styles.css`, `app.js`, `math.js`, `model-data.js`, and `.nojekyll`. They are all directly at this repository's root. Keep them together. The original CSV, Python environment, `scripts/`, `data/`, and `dist/` are not required to run the root site.

In the repository's **Settings → Pages**, select **Deploy from a branch**, choose **master**, and select **/(root)**. GitHub Pages serves the root `index.html` and its neighboring files directly; `.nojekyll` disables Jekyll processing.

The root page uses relative paths, so the site works under a project URL such as `https://OWNER.github.io/REPOSITORY/` without base-path configuration. For future edits, include the changed root files when you commit and push. No GitHub Actions build workflow is needed.

References: [GitHub Pages entry files and static generators](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [branch and folder configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The calculation checks run with Node:

```sh
node --test scripts/check-models.mjs
```

These check regression fitting, tree routes and boundaries, all 120 forest slider settings against scikit-learn predictions, PCA variance and projection, and animation interpolation. All implementation, builds, and previews remain local.
