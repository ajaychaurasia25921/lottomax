package com.lottomax.enterprise.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GatewayWebhook(
        @NotBlank String eventId,
        @NotBlank String gatewayReference,
        @NotBlank String eventType,
        @Valid @NotNull Money amount
) {
}
