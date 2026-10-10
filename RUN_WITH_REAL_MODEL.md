# Run the frontend with the real trained model

## 1. Backend

Open a terminal:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then:

```bash
pip install -r requirements.txt
python app.py
```

The Flask API runs at:

`http://127.0.0.1:5000`

Check:

`http://127.0.0.1:5000/api/health`

## 2. Frontend

Open another terminal in the project root:

```bash
npm run dev
```

Open the Vite URL shown in the terminal.

Go to **Dynamic Price Optimization** and click **Generate Dynamic Price**.

The button now calls:

React → Flask → `demand_model.pkl` → candidate price predictions → profit/revenue optimization → React result.

There is no frontend dummy pricing calculation in `PriceOptimization.jsx`.

## Note

The current trained model requires its saved 18-feature schema. Some dashboard fields such as inventory and competitor price are collected by the UI for business context, but they are not model inputs in the current `demand_model.pkl` schema. They are therefore not artificially injected into the model.
