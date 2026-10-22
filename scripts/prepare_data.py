"""Prepare the small, numeric teaching examples from the existing class CSV."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor  # Train the small forest shown in the animation.
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

PROJECT = Path(__file__).resolve().parents[1]
CLASS = PROJECT.parent
listings = pd.read_csv(CLASS / 'data/denver/denver_listings.csv')
listings['usd'] = pd.to_numeric(listings['price'].str.replace(r'[$,]', '', regex=True), errors='coerce')
features = ['accommodates', 'bedrooms', 'location_rating']
usable = listings.query("room_type == 'Entire home/apt' and accommodates >= 2 and minimum_nights <= 3")
usable = usable.dropna(subset=features + ['usd']).query('usd > 0')
train, test = train_test_split(usable, test_size=.2, random_state=42)

demo_ids = [3891080, 20695085, 650229313687775276, 1224271566011521481, 812343050926145216, 1416143888763488127]
demo = train[train.listing_id.isin(demo_ids)].sort_values('accommodates')
line = LinearRegression().fit(demo[['accommodates']], demo.usd)
points = [{'x': int(row.accommodates), 'y': float(row.usd)} for row in demo.itertuples()]

tree = DecisionTreeRegressor(max_depth=2, min_samples_leaf=20, random_state=42).fit(train[features], train.usd)
nodes = []
for index in range(tree.tree_.node_count):
    nodes.append({'id': index, 'left': int(tree.tree_.children_left[index]), 'right': int(tree.tree_.children_right[index]),
                  'feature': features[tree.tree_.feature[index]] if tree.tree_.feature[index] >= 0 else None,
                  'threshold': float(tree.tree_.threshold[index]), 'price': float(tree.tree_.value[index][0, 0]),
                  'samples': int(tree.tree_.n_node_samples[index])})

# Three shallow trees keep every branch visible; the notebook's full model uses 200 trees.
forest_features = ['accommodates', 'bedrooms']  # Keep the same two inputs as the on-screen sliders.
forest = RandomForestRegressor(n_estimators=3, max_depth=2, min_samples_leaf=20,
                               max_features=1, bootstrap=True, random_state=42)
forest.fit(train[forest_features], train.usd)  # Each tree learns from a resampled set of training listings.
forest_trees = []  # Save the learned questions and leaf prices for offline prediction in JavaScript.
for estimator in forest.estimators_:
    learned = estimator.tree_  # Access the fitted tree's numeric structure.
    forest_trees.append([{
        'id': index, 'left': int(learned.children_left[index]), 'right': int(learned.children_right[index]),
        'feature': forest_features[learned.feature[index]] if learned.feature[index] >= 0 else None,
        'threshold': float(learned.threshold[index]), 'price': float(learned.value[index][0, 0]),
        'samples': int(learned.n_node_samples[index])
    } for index in range(learned.node_count)])
forest_examples = pd.DataFrame([(capacity, bedrooms) for capacity in range(2, 17) for bedrooms in range(1, 9)],
                              columns=forest_features)  # Cover every setting offered by the sliders.
forest_reference = forest_examples.to_dict('records')  # Keep independent scikit-learn answers for verification.
for example, price in zip(forest_reference, forest.predict(forest_examples)):
    example['price'] = float(price)  # Store the average of all three unrounded tree predictions.

size = ['accommodates', 'bedrooms']
scaler = StandardScaler().fit(train[size])
z_train = scaler.transform(train[size])
z_test = scaler.transform(test[size])
pca = PCA(n_components=2).fit(z_train)
selected = []
for capacity, bedrooms in [(2, 1), (4, 1), (4, 2), (6, 3), (10, 4), (16, 6)]:
    index = np.flatnonzero((test.accommodates.to_numpy() == capacity) & (test.bedrooms.to_numpy() == bedrooms))[0]
    selected.append({'x': float(z_test[index, 0]), 'y': float(z_test[index, 1]), 'capacity': capacity, 'bedrooms': bedrooms})

data = {
    'source': {'name': 'Inside Airbnb · Denver classroom CSV', 'date': 'June 30, 2026', 'trainingRows': len(train), 'testRows': len(test)},
    'regression': {'points': points, 'reference': {'slope': float(line.coef_[0]), 'intercept': float(line.intercept_),
                   'mse': float(np.mean((line.predict(demo[['accommodates']]) - demo.usd) ** 2))}},
    'tree': {'nodes': nodes},
    'forest': {'trees': forest_trees, 'reference': forest_reference, 'trainingRows': len(train),
               'bootstrap': True, 'maxFeatures': 1, 'maxDepth': 2},
    'pca': {'points': [{'x': float(x), 'y': float(y)} for x, y in z_test], 'selected': selected,
            'covariance': np.cov(z_train, rowvar=False, bias=True).tolist(),
            'direction': pca.components_[0].tolist(), 'varianceRatio': float(pca.explained_variance_ratio_[0])}
}
(PROJECT / 'data').mkdir(exist_ok=True)
(PROJECT / 'data/model-data.json').write_text(json.dumps(data, indent=2))
print(f'Prepared {len(points)} regression examples, {len(nodes)} tree nodes, {len(forest_trees)} forest trees, and {len(z_test)} PCA points.')
