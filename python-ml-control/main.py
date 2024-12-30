import sys

def handle_command(command):
    if command == "CALLBACK PING":
        return "Ping acknowledged by Python."
    elif command == "EXIT":
        return "Exiting Python..."
    else:
        return f"Unknown command to Python: {command}"

def main():
    while True:
        # Read command from stdin
        command = sys.stdin.readline().strip()
        
        if command == "EXIT":
            print(handle_command(command))
            break
        elif command:
            # Process the command and output response
            print(handle_command(command))

if __name__ == "__main__":
    print("Python subsystem started.")
    main()
