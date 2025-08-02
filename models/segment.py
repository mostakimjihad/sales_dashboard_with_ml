# models/segment.py
from odoo import models, fields, api
from datetime import date
import numpy as np
from sklearn.cluster import KMeans


class ResPartnerSegment(models.Model):
    _name = 'res.partner.segment'
    _description = 'Customer RFM Segment'
    partner_id = fields.Many2one('res.partner', string="Customer", required=True)
    cluster_id = fields.Integer("Cluster")
    recency = fields.Float("Recency (days)")
    frequency = fields.Integer("Frequency")
    monetary = fields.Float("Monetary")
    active = fields.Boolean(default=True)

    @api.model
    def compute_customer_segments(self, num_clusters=3):
        """Compute customer clusters based on RFM and store them."""
        partners = self.env['res.partner'].search([('customer_rank', '>', 0)])
        data = []
        partners_with_sales = []
        today = date.today()
        # Build RFM table for each partner
        for partner in partners:
            orders = self.env['sale.order'].search([
                ('partner_id', '=', partner.id),
                ('state', 'in', ['sale', 'done'])
            ])
            if not orders:
                continue
            last_order = max(orders, key=lambda o: o.date_order)
            recency = (today - last_order.date_order.date()).days
            freq = len(orders)
            monetary = sum(o.amount_total for o in orders)
            data.append([recency, freq, monetary])
            partners_with_sales.append(partner.id)
        if not data:
            return
        X = np.array(data)
        # Normalize or scale RFM as needed (omitted for brevity)
        kmeans = KMeans(n_clusters=num_clusters, random_state=1).fit(X)
        labels = kmeans.labels_
        # Remove old segments
        self.search([]).unlink()
        # Create new segment records
        for pid, cluster, (rec, freq, mon) in zip(partners_with_sales, labels, data):
            self.create({
                'partner_id': pid,
                'cluster_id': int(cluster),
                'recency': float(rec),
                'frequency': int(freq),
                'monetary': float(mon),
            })
