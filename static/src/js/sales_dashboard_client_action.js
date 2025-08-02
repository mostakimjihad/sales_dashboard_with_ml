/** @odoo-module **/

import { Component, onMounted, onWillStart, useState, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

export class SalesDashboardClientAction extends Component {
    static template = "sales_dashboard.client";

    setup() {
        this.forecastCanvas = useRef("forecastChart");
        this.productsCanvas = useRef("productsChart");
        this.segmentsCanvas = useRef("segmentsChart");
        this.salespersonCanvas = useRef("salespeopleChart");
        this.lifetimeCanvas = useRef("lifetimeChart");
        this.funnelCanvas = useRef("funnelChart");
        this.yoyCanvas = useRef("yoyChart");

        this.state = useState({
            loading: true,
            error: null,
            kpis: {
                total_sales: 0,
                sales_change: 0,
                target_achievement: 0,
                target_change: 0,
                new_leads: 0,
                leads_change: 0,
                conversion_rate: 0,
                conversion_change: 0,
            },
            charts: {
                forecast: null,
                products: null,
                segments: null,
                salespersons: null,
                lifetime: null,
                funnel: null,
                yoy: null,
            }
        });

        this._dashboardData = null;

        onWillStart(async () => {
            try {
                await this.loadChartJS();
            } catch (error) {
                this.state.error = "Failed to load chart library";
                this.state.loading = false;
                console.error("Chart.js loading error:", error);
            }
        });

        onMounted(() => {
            this.loadDataAndRenderCharts();
        });
    }

    formatCurrency(value) {
        if (typeof value !== 'number') return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    formatPercentage(value) {
        if (typeof value !== 'number') return '0%';
        return `${value}%`;
    }

    async loadChartJS() {
        if (typeof Chart === "undefined") {
            const { loadJS } = await import("@web/core/assets");
            await loadJS("/web/static/lib/Chart/Chart.js");
            if (typeof Chart === "undefined") {
                throw new Error("Chart.js failed to load");
            }
        }
    }

    async ensureCanvasesReady() {
        let attempts = 0;
        const maxAttempts = 5;
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        while (attempts < maxAttempts) {
            if (this.forecastCanvas.el &&
                this.productsCanvas.el &&
                this.segmentsCanvas.el &&
                this.salespersonCanvas.el &&
                this.lifetimeCanvas.el &&
                this.funnelCanvas.el &&
                this.yoyCanvas.el) {
                return true;
            }
            await delay(50 * (attempts + 1));
            attempts++;
        }
        return false;
    }

    async loadDataAndRenderCharts() {
        try {
            this.state.loading = true;
            this.state.error = null;

            const data = await rpc("/sales_dashboard/data");
            if (!data?.months || !data?.actual || !data?.forecast) {
                throw new Error("Invalid data format received");
            }

            this._dashboardData = data;

            // Update KPIs in state
            if (data.kpis) {
                this.state.kpis = {
                    total_sales: data.kpis.total_sales || 0,
                    sales_change: data.kpis.sales_change || 0,
                    target_achievement: data.kpis.target_achievement || 0,
                    target_change: data.kpis.target_change || 0,
                    new_leads: data.kpis.new_leads || 0,
                    leads_change: data.kpis.leads_change || 0,
                    conversion_rate: data.kpis.conversion_rate || 0,
                    conversion_change: data.kpis.conversion_change || 0,
                };
            }

            this.state.loading = false;

            if (!await this.ensureCanvasesReady()) {
                throw new Error("Chart containers not ready after multiple attempts");
            }

            this.destroyCharts();
            this.createCharts(this._dashboardData);
        } catch (error) {
            this.state.error = error.message || "Failed to load dashboard";
            console.error("Dashboard error:", error);
            this.state.loading = false;
        }
    }

    destroyCharts() {
        Object.entries(this.state.charts).forEach(([key, chart]) => {
            try {
                if (chart) {
                    const canvasRef = this[`${key}Canvas`];
                    if (canvasRef?.el?._chart) {
                        canvasRef.el._chart.destroy();
                        canvasRef.el._chart = null;
                    }
                    this.state.charts[key] = null;
                }
            } catch (e) {
                console.warn(`Error destroying ${key} chart:`, e);
            }
        });
    }

    createCharts(data) {
        const createChart = (canvasRef, config) => {
            if (!canvasRef.el) return null;

            try {
                // Clear any existing chart instance
                if (canvasRef.el._chart) {
                    canvasRef.el._chart.destroy();
                }

                const ctx = canvasRef.el.getContext("2d");
                return new Chart(ctx, config);
            } catch (e) {
                console.error("Error creating chart:", e);
                return null;
            }
        };

        this.state.charts.forecast = createChart(
            this.forecastCanvas,
            this.getForecastConfig(data)
        );

        this.state.charts.products = createChart(
            this.productsCanvas,
            this.getProductsConfig(data)
        );

        this.state.charts.segments = createChart(
            this.segmentsCanvas,
            this.getSegmentsConfig(data)
        );

        this.state.charts.salespersons = createChart(
            this.salespersonCanvas,
            this.getSalespersonConfig(data)
        );

        this.state.charts.lifetime = createChart(
            this.lifetimeCanvas,
            this.getLifetimeConfig(data)
        );

        this.state.charts.funnel = createChart(
            this.funnelCanvas,
            this.getFunnelConfig(data)
        );

        this.state.charts.yoy = createChart(
            this.yoyCanvas,
            this.getYoyConfig(data)
        );
    }

    getForecastConfig(data) {
        return {
            type: "line",
            data: {
                labels: data.months,
                datasets: [
                    {
                        label: "Actual Sales",
                        data: data.actual,
                        borderColor: "#3a7bd5",
                        backgroundColor: "rgba(58, 123, 213, 0.1)",
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: "Forecast",
                        data: data.forecast,
                        borderColor: "#00d2ff",
                        backgroundColor: "rgba(0, 210, 255, 0.1)",
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top"
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        },
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        };
    }

    getProductsConfig(data) {
        return {
            type: "bar",
            data: {
                labels: data.top_products?.names || [],
                datasets: [{
                    label: "Revenue",
                    data: data.top_products?.values || [],
                    backgroundColor: [
                        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
                        "#FF9F40", "#8AC24A", "#EA5F89", "#05C3DD", "#FFA07A"
                    ],
                    borderColor: "#FFFFFF",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.label}: ${this.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        };
    }

    getSegmentsConfig(data) {
        return {
            type: "doughnut",
            data: {
                labels: data.segments?.labels || [],
                datasets: [{
                    data: data.segments?.values || [],
                    backgroundColor: [
                        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
                        "#FF9F40", "#8AC24A", "#EA5F89", "#05C3DD", "#FFA07A"
                    ],
                    borderColor: "#FFFFFF",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "right"
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.raw;
                                const percentage = Math.round((value / total) * 100);
                                return `${context.label}: ${percentage}% (${this.formatCurrency(value)})`;
                            }
                        }
                    }
                },
                cutout: "70%"
            }
        };
    }

    getSalespersonConfig(data) {
        return {
            type: "bar",
            data: {
                labels: data.salespersons?.names || [],
                datasets: [{
                    label: "Sales by Salesperson",
                    data: data.salespersons?.values || [],
                    backgroundColor: [
                        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"
                    ],
                    borderColor: "#FFFFFF",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.label}: ${this.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        };
    }

    getLifetimeConfig(data) {
        return {
            type: "bar",
            data: {
                labels: data.lifetime_values?.names || [],
                datasets: [{
                    label: "Customer Lifetime Value",
                    data: data.lifetime_values?.values || [],
                    backgroundColor: [
                        "#36A2EB", "#FF6384", "#FFCE56", "#4BC0C0", "#9966FF"
                    ],
                    borderColor: "#FFFFFF",
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.label}: ${this.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        };
    }

    getFunnelConfig(data) {
        return {
            type: "bar",
            data: {
                labels: data.funnel?.labels || [],
                datasets: [{
                    label: "Count",
                    data: data.funnel?.values || [],
                    backgroundColor: "#36A2EB",
                    borderColor: "#FFFFFF",
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.label}: ${context.raw.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        };
    }

    getYoyConfig(data) {
        return {
            type: "line",
            data: {
                labels: data.yoy?.months || [],
                datasets: [
                    {
                        label: "This Year",
                        data: data.yoy?.current_year || [],
                        borderColor: "#3a7bd5",
                        backgroundColor: "rgba(58, 123, 213, 0.1)",
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: "Last Year",
                        data: data.yoy?.last_year || [],
                        borderColor: "#FF6384",
                        backgroundColor: "rgba(255, 99, 132, 0.1)",
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top"
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        };
    }
}

registry.category("actions").add("sales_dashboard.client", SalesDashboardClientAction);