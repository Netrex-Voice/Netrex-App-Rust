"use client";

/**
 * 📬 FriendRequestList - Displays incoming and outgoing friend requests
 */

import { Inbox, Send } from "lucide-react";
import FriendItem from "./FriendItem";
import { SectionCard, EmptyState } from "./FriendsUI";

export default function FriendRequestList({
  incomingRequests,
  outgoingRequests,
  onAccept,
  onReject,
  onCancelRequest,
}) {
  const hasRequests = incomingRequests.length > 0 || outgoingRequests.length > 0;

  if (!hasRequests) {
    return (
      <EmptyState
        icon={Inbox}
        title="Bekleyen istek yok"
        description="Şu anda bekleyen bir arkadaşlık isteğin bulunmuyor."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <SectionCard icon={Inbox} tone="green" title="Gelen İstekler" count={incomingRequests.length} countTone="red">
          <div className="space-y-1.5">
            {incomingRequests.map((request) => (
              <FriendItem
                key={request.id}
                user={request.senderData}
                variant="incoming"
                friendshipId={request.id}
                onAccept={onAccept}
                onReject={onReject}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <SectionCard icon={Send} tone="slate" title="Gönderilen İstekler" count={outgoingRequests.length}>
          <div className="space-y-1.5">
            {outgoingRequests.map((request) => (
              <FriendItem
                key={request.id}
                user={request.receiverData}
                variant="outgoing"
                friendshipId={request.id}
                onCancelRequest={onReject}
              />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
