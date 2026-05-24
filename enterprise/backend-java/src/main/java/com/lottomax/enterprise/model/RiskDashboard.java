package com.lottomax.enterprise.model;

public record RiskDashboard(
        Money ticketSales,
        double hotWalletLiquidityPercent,
        int velocityAlerts,
        int manualReviews
) {
}
