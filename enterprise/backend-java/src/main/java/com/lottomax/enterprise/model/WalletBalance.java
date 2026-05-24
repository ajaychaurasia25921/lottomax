package com.lottomax.enterprise.model;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WalletBalance(
        UUID walletId,
        Money available,
        Money held,
        OffsetDateTime updatedAt
) {
}
