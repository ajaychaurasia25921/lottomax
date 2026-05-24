package com.lottomax.enterprise.model;

import java.util.UUID;

public record DepositIntent(
        UUID depositId,
        String status,
        String gatewayReference
) {
}
