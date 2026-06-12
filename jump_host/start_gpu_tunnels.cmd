@echo off
setlocal
set ROOT=%~dp0..
set CONFIG=%ROOT%\config\hosts.example.json
set AGENT_PORT=18180
set SSH_USER=g24tka12

echo Starting GPU status SSH tunnels. Close old ssh.exe tunnel processes manually if ports are already bound.
start "a6000-143" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18143:127.0.0.1:%AGENT_PORT% %SSH_USER%@192.168.2.143
start "a6000-144" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18144:127.0.0.1:%AGENT_PORT% %SSH_USER%@192.168.2.151
start "a6000-048" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18048:127.0.0.1:%AGENT_PORT% %SSH_USER%@172.23.4.48
start "a6000-147" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18147:127.0.0.1:%AGENT_PORT% %SSH_USER%@172.23.4.53
start "a6000-155" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18155:127.0.0.1:%AGENT_PORT% %SSH_USER%@192.168.2.155
start "rtx4090-224" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18224:127.0.0.1:%AGENT_PORT% %SSH_USER%@192.168.2.152
start "rtx4090-56" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18056:127.0.0.1:%AGENT_PORT% %SSH_USER%@172.23.4.56
start "rtx4090-47" /min C:\Windows\System32\OpenSSH\ssh.exe -f -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -L 127.0.0.1:18047:127.0.0.1:%AGENT_PORT% %SSH_USER%@172.23.4.47
endlocal

