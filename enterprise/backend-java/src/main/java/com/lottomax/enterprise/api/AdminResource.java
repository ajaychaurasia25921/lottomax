package com.lottomax.enterprise.api;

import com.lottomax.enterprise.model.BroadGroupRequest;
import com.lottomax.enterprise.model.BroadGroupResponse;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@Path("/v1/admin")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AdminResource {
    @POST
    @Path("/broad-groups")
    public Response createBroadGroup(@Valid BroadGroupRequest request) {
        BroadGroupResponse response = new BroadGroupResponse(
                UUID.randomUUID(),
                request.name(),
                "OPEN",
                request.maxPlayers(),
                request.ticketPrice()
        );
        return Response.status(Response.Status.CREATED).entity(response).build();
    }
}
