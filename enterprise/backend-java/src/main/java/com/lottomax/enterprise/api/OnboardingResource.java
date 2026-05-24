package com.lottomax.enterprise.api;

import com.lottomax.enterprise.model.MfaOnboardingRequest;
import com.lottomax.enterprise.model.MfaOnboardingResponse;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@Path("/v1/onboarding")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class OnboardingResource {
    @POST
    @Path("/mfa")
    public Response startMfa(@Valid MfaOnboardingRequest request) {
        MfaOnboardingResponse response = new MfaOnboardingResponse(UUID.randomUUID(), "challenge_started", "pending");
        return Response.accepted(response).build();
    }
}
