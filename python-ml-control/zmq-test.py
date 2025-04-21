import zmq

ctx = zmq.Context()
sock = ctx.socket(zmq.REP)
sock.bind("tcp://127.0.0.1:5836")

while True:
    msg = sock.recv_json()            # e.g. {"method":"status"}
    if msg["method"] == "status":
        sock.send_json({"ok":True, "uptime":123})
    else:
        sock.send_json({"error":"unknown"})