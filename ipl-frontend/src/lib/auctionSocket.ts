import SockJS from "sockjs-client"
import { Client, IMessage } from "@stomp/stompjs"
import { AuctionEvent } from "@/types/AuctionEvent"

export function createAuctionSocket(
  playerId: string,
  participantId: string,        // ✅ ADDED: needed to subscribe to private wallet topic
  onEvent: (event: AuctionEvent) => void
) {
  const client = new Client({
    // ✅ Pass participantId as query param so the backend HandshakeHandler
    //    sets it as the STOMP Principal — required for convertAndSendToUser
    webSocketFactory: () =>
      new SockJS(`http://localhost:8080/ws?participantId=${participantId}`),

    reconnectDelay: 3000,

    onConnect: () => {

      // Public topic — all clients see bids, sold events, timer for this player
      client.subscribe(
        `/topic/auction/${playerId}`,
        (message: IMessage) => {
          const payload: AuctionEvent = JSON.parse(message.body)
          onEvent(payload)
        }
      )

      // ✅ ADDED: Private topic — only THIS participant receives their own wallet update
      // Spring maps /user/queue/wallet → /user/{Principal.name}/queue/wallet
      // The Principal name must match participantId (see WebSocket security config)
      client.subscribe(
        `/user/queue/wallet`,
        (message: IMessage) => {
          const payload: AuctionEvent = JSON.parse(message.body)
          onEvent(payload)
        }
      )
    },
  })

  client.activate()

  return client
}