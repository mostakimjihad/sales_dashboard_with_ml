# controllers/sales_dashboard.py
from odoo import http
from odoo.http import request
from datetime import datetime

class SalesDashboard(http.Controller):
    @http.route('/sales_dashboard/data', auth='user', type='json', cors='*')
    def dashboard_data(self, **kw):
        """Return JSON data for charts: sales, forecast, top products, salesperson, CLV, funnel, YoY."""

        orders = request.env['sale.order'].search([('state', 'in', ['sale', 'done'])])
        sales_by_month = {}
        for order in orders:
            if order.date_order:
                m = order.date_order.strftime('%Y-%m')
                sales_by_month.setdefault(m, 0.0)
                sales_by_month[m] += order.amount_total
        sorted_months = sorted(sales_by_month.keys())
        actual_values = [sales_by_month[m] for m in sorted_months]

        # Last 12 months
        months = sorted_months[-12:]
        actual = actual_values[-12:]
        # Year-over-Year values
        last_year = []
        for m in months:
            year, mon = map(int, m.split('-'))
            prev_key = f"{year - 1:04d}-{mon:02d}"
            last_year.append(sales_by_month.get(prev_key, 0.0))

        # Forecast (existing model or fallback 10% growth)
        forecast_vals = []
        try:
            forecast_records = request.env['sale.forecast'].search([], order='month asc')
            forecast_vals = [rec.forecast for rec in forecast_records]
        except:
            if actual:
                last_val = actual[-1]
                forecast_vals = [last_val * 1.1 for _ in range(3)]

        # Top Products by revenue
        prod_sales = {}
        for line in request.env['sale.order.line'].search([('state', 'in', ['sale', 'done'])]):
            name = line.product_id.display_name or 'Unknown'
            prod_sales[name] = prod_sales.get(name, 0.0) + line.price_subtotal
        top5 = sorted(prod_sales.items(), key=lambda x: x[1], reverse=True)[:5]
        prod_labels = [x[0] for x in top5]
        prod_values = [x[1] for x in top5]

        # Customer segments (if model exists)
        clusters, counts = [], []
        if hasattr(request.env, 'res.partner.segment'):
            seg_count = {}
            for seg in request.env['res.partner.segment'].search([]):
                cluster = seg.cluster_id.name if seg.cluster_id else 'Unknown'
                seg_count[cluster] = seg_count.get(cluster, 0) + 1
            clusters = list(seg_count.keys())
            counts = [seg_count[c] for c in clusters]

        # Sales by Salesperson (top 5 sales reps by total sales)
        salespersons = {}
        for order in orders:
            name = order.user_id.name or 'Unknown'
            salespersons[name] = salespersons.get(name, 0.0) + order.amount_total
        top_sales = sorted(salespersons.items(), key=lambda x: x[1], reverse=True)[:5]
        sales_labels = [x[0] for x in top_sales]
        sales_values = [x[1] for x in top_sales]

        # Customer Lifetime Value (top 5 customers by total sales)
        customer_sales = {}
        for order in orders:
            partner = order.partner_id.name or 'Unknown'
            customer_sales[partner] = customer_sales.get(partner, 0.0) + order.amount_total
        top_cust = sorted(customer_sales.items(), key=lambda x: x[1], reverse=True)[:5]
        cust_labels = [x[0] for x in top_cust]
        cust_values = [x[1] for x in top_cust]

        # Sales funnel: leads -> opportunities -> quotes -> orders
        leads_count = request.env['crm.lead'].search_count([('type', '=', 'lead')])
        opp_count = request.env['crm.lead'].search_count([('type', '=', 'opportunity')])
        quotes_count = request.env['sale.order'].search_count([('state', '=', 'sent')])
        orders_count = len(orders)
        funnel_labels = ['Leads', 'Opportunities', 'Quotations', 'Orders']
        funnel_values = [leads_count, opp_count, quotes_count, orders_count]

        data = {
            'months': months,
            'actual': actual,
            'forecast': forecast_vals[:6],
            'top_products': {'names': prod_labels, 'values': prod_values},
            'segments': {'labels': clusters, 'values': counts},
            'salespersons': {'names': sales_labels, 'values': sales_values},
            'lifetime_values': {'names': cust_labels, 'values': cust_values},
            'funnel': {'labels': funnel_labels, 'values': funnel_values},
            'yoy': {'months': months, 'last_year': last_year, 'current_year': actual},
        }
        print(data)
        return data
