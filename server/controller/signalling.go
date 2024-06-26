package server

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var AllRooms RoomMap

func CreateRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	roomID := AllRooms.CreateRoom()

	type resp struct {
		RoomID string `json:"room_id"`
	}

	log.Println(AllRooms.Map)
	json.NewEncoder(w).Encode(resp{RoomID: roomID})
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type broadcastMsg struct {
	Message map[string]interface{}
	RoomID  string
	Client  *websocket.Conn
}

var broadcast = make(chan broadcastMsg)

func broadcaster() {
	for {
		msg := <-broadcast
		for _, client := range AllRooms.Map[msg.RoomID] {
			if client.Conn != msg.Client {
				client.Mutex.Lock()
				err := client.Conn.WriteJSON(msg.Message)
				if err != nil {
					log.Fatal(err)
					client.Conn.Close()
				}
				client.Mutex.Unlock()
			}
		}
	}
}

func JoinRoomRequestHandler(w http.ResponseWriter, r *http.Request) {
	roomID, ok := r.URL.Query()["roomID"]
	if !ok {
		log.Fatal("Room ID is missing int the Query Param")
		return
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal("Websocket upgrader error")
		return
	}

	AllRooms.InsertIntoRoom(roomID[0], false, ws)

	go broadcaster()

	for {
		var msg broadcastMsg

		err := ws.ReadJSON(&msg.Message)

		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseGoingAway) {
				log.Println("WebSocket connection closed:", err)
				AllRooms.DeleteFromRoom(roomID[0], ws)
				break
			}
			log.Fatal("Read Error ", err)
		}

		msg.Client = ws
		msg.RoomID = roomID[0]
		log.Println(msg.Message)

		broadcast <- msg
	}

}
