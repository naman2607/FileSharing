package main

import (
	"log"
	"net/http"

	server "github.com/naman2607/signallingserver/controller"
)

func main() {
	server.AllRooms.Init()

	http.HandleFunc("/create", server.CreateRequestHandler)
	http.HandleFunc("/join", server.JoinRoomRequestHandler)

	log.Println("starting server on Port : 8084")

	err := http.ListenAndServe(":8084", nil)
	if err != nil {
		log.Fatal(err)
	}

}
