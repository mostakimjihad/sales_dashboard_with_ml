# __manifest__.py
{
    'name': "Sales Analytics Dashboard",
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': "Predictive sales analytics and custom dashboard",
    'description': """
        Sales Analytics with Machine Learning:
        - Historical sales charts
        - Forecast next month’s sales (linear regression)
        - Top products by revenue
        - Customer RFM segmentation (K-Means)
    """,
    'author': "Mostakim Jihad",
    'license': 'LGPL-3',
    'depends': ['sale', 'web'],  # depends on Odoo Sales and Web
    'data': [
        'security/ir.model.access.csv',
        'views/sales_dashboard.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'sales_dashboard_with_ml/static/src/js/sales_dashboard_client_action.js',
            'sales_dashboard_with_ml/static/src/xml/sales_dashboard_template.xml',
            'web/static/lib/Chart/Chart.js',
        ],
    },
    'external_dependencies': {
        'python': ['scikit-learn', 'pandas', 'numpy'],
    },
    'installable': True,
    'application': False,
}
