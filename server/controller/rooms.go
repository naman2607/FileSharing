package server

import (
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Participant struct {
	Host  bool
	Conn  *websocket.Conn
	Mutex sync.Mutex
}

type RoomMap struct {
	Mutex sync.Mutex
	Map   map[string][]*Participant
}

func (r *RoomMap) Init() {
	r.Map = make(map[string][]*Participant)
}

func (r *RoomMap) Get(roomID string) []*Participant {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	return r.Map[roomID]
}

func (r *RoomMap) CreateRoom() string {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	rand.Seed(time.Now().UnixNano())

	var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890")
	b := make([]rune, 8)

	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}

	roomID := string(b)

	r.Map[roomID] = []*Participant{}

	return roomID
}

func (r *RoomMap) InsertIntoRoom(roomID string, host bool, conn *websocket.Conn) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	p := &Participant{
		Host: host,
		Conn: conn,
	}

	log.Println("Inserting a participant into a room with roomID : ", roomID)

	r.Map[roomID] = append(r.Map[roomID], p)
}

func findIndexInRoom(allParticipants []*Participant, conn *websocket.Conn) int {

	for i, v := range allParticipants {
		if v.Conn == conn {
			return i
		}
	}
	return -1
}

func (r *RoomMap) DeleteFromRoom(roomID string, conn *websocket.Conn) {
	log.Println("Deleting a participant from room with roomID: ", roomID)

	allParticipantsInARoom := r.Map[roomID]
	index := findIndexInRoom(allParticipantsInARoom, conn)
	if index == -1 {
		return
	}
	allParticipantsInARoom = append(allParticipantsInARoom[:index], allParticipantsInARoom[index+1:]...)
	r.Map[roomID] = allParticipantsInARoom
}
