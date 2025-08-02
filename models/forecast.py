# models/forecast.py
from odoo import models, fields, api
from datetime import datetime
import numpy as np
from sklearn.linear_model import LinearRegression

class SaleForecast(models.Model):
    _name = 'sale.forecast'
    _description = 'Monthly Sales Forecast'
    month = fields.Date('Month', required=True)
    forecast = fields.Float('Forecasted Sales', readonly=True)

    @api.model
    def compute_sales_forecast(self):
        """Compute next-month sales forecast using linear regression on historical data."""
        # Gather actual sales per month from sale.order (state 'sale' or 'done')
        orders = self.env['sale.order'].search([('state', 'in', ['sale','done'])])
        sales_by_month = {}
        for order in orders:
            if order.date_order:
                m = order.date_order.strftime('%Y-%m')
                sales_by_month.setdefault(m, 0.0)
                sales_by_month[m] += order.amount_total
        # Sort by date (ascending)
        sorted_months = sorted(sales_by_month.keys())
        if len(sorted_months) < 2:
            # Not enough data
            return
        # Prepare regression data
        X = np.arange(len(sorted_months)).reshape(-1, 1)  # e.g. [[0], [1], [2], ...]
        y = np.array([sales_by_month[m] for m in sorted_months])
        model = LinearRegression()
        model.fit(X, y)
        # Predict next month
        next_index = np.array([[len(sorted_months)]])
        next_value = float(model.predict(next_index)[0])
        # Compute next month date (assuming last month in sorted_months)
        last_month_str = sorted_months[-1]  # format 'YYYY-MM'
        last_year, last_mon = map(int, last_month_str.split('-'))
        # increment month
        if last_mon == 12:
            next_year, next_mon = last_year + 1, 1
        else:
            next_year, next_mon = last_year, last_mon + 1
        next_month_date = datetime(next_year, next_mon, 1)
        # Create or update forecast record
        self.env['sale.forecast'].create({
            'month': next_month_date.date(),
            'forecast': next_value,
        })
