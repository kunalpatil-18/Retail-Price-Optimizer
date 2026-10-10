from pathlib import Path
import json, joblib, numpy as np, pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor, ExtraTreesRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
ROOT=Path('/mnt/data/RetailPrice_Optimizer/backend'); DATA=ROOT/'data'/'historical_sales.csv'
df=pd.read_csv(DATA); df['Date']=pd.to_datetime(df['Date'],errors='coerce'); df=df[df['Category'].astype(str).str.casefold().eq('electronics')].copy()
df['Month']=df.Date.dt.month; df['DayOfWeek']=df.Date.dt.dayofweek; df['Year']=df.Date.dt.year
df=df.dropna(subset=['Quantity','UnitPrice_INR']).sort_values('Date')
features=['Product','UnitPrice_INR','BaseUnitPrice_INR','UnitCost_INR','Discount','Region','CustomerType','Promotion','Month','DayOfWeek','Year']; cats=['Product','Region','CustomerType','Promotion']; nums=[c for c in features if c not in cats]
def prep(): return ColumnTransformer([('cat',Pipeline([('impute',SimpleImputer(strategy='most_frequent')),('ohe',OneHotEncoder(handle_unknown='ignore'))]),cats),('num',Pipeline([('impute',SimpleImputer(strategy='median'))]),nums)])
models=[('RandomForest',RandomForestRegressor(n_estimators=400,min_samples_leaf=4,max_features=.9,random_state=42,n_jobs=-1)),('ExtraTrees',ExtraTreesRegressor(n_estimators=400,min_samples_leaf=4,max_features=.9,random_state=42,n_jobs=-1)),('GradientBoosting',GradientBoostingRegressor(n_estimators=150,max_depth=2,learning_rate=.04,loss='huber',random_state=42))]
split=int(len(df)*.8); train,test=df.iloc[:split],df.iloc[split:]; scores=[]
for name,reg in models:
 pipe=Pipeline([('preprocess',prep()),('model',reg)]); pipe.fit(train[features],train.Quantity); pred=np.maximum(0,pipe.predict(test[features])); scores.append({'name':name,'mae':float(mean_absolute_error(test.Quantity,pred)),'rmse':float(mean_squared_error(test.Quantity,pred)**.5),'r2':float(r2_score(test.Quantity,pred))})
winner=min(scores,key=lambda x:x['mae']); final=Pipeline([('preprocess',prep()),('model',dict(models)[winner['name']])]); final.fit(df[features],df.Quantity)
(ROOT/'models').mkdir(exist_ok=True); joblib.dump(final,ROOT/'models'/'electronics_demand_model.joblib')
metrics={'category':'Electronics','rows':int(len(df)),'products':sorted(df.Product.unique().tolist()),'selected_model':winner['name'],'holdout':winner,'all_model_scores':scores,'features':features,'target':'Quantity','validation_method':'chronological 80/20 split; selected by holdout MAE','limitation':'Historical observational data cannot establish causal price elasticity. Competitor prices are not in training data.'}
(ROOT/'models'/'electronics_model_metrics.json').write_text(json.dumps(metrics,indent=2)); print(json.dumps(metrics,indent=2))
