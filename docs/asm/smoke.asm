; smoke.asm -- toolchain smoke test for the browser IDE.
;
; Deliberately small. It exercises every DOS service the IDE has to support,
; and nothing else:
;
;   AH=09h   print a $-terminated string        (output path)
;   AH=0Ah   buffered line input                (interactive path + backspace)
;   AH=4Ch   terminate with an exit code        (how the IDE knows we finished)
;
; Reading the buffer back and reprinting it is the point: seeing characters
; appear on screen only proves the echo works. Printing them back proves they
; actually landed in memory where the program can use them.
;
;   nasm -f bin smoke.asm -o smoke.com

        org     100h            ; .COM images load at offset 100h

start:
        mov     ah, 09h
        mov     dx, banner
        int     21h

        mov     ah, 09h
        mov     dx, prompt
        int     21h

        mov     ah, 0Ah         ; buffered input -> DS:DX
        mov     dx, inbuf
        int     21h

        mov     ah, 09h         ; AH=0Ah leaves the cursor on the CR
        mov     dx, crlf
        int     21h

        mov     ah, 09h
        mov     dx, echoed
        int     21h

        ; inbuf+1 holds how many characters DOS actually stored, and the
        ; characters themselves start at inbuf+2. Terminating them with '$'
        ; turns the raw buffer into something AH=09h can print.
        xor     bx, bx
        mov     bl, [inbuf+1]
        mov     byte [inbuf+2+bx], '$'

        mov     ah, 09h
        mov     dx, inbuf+2
        int     21h

        mov     ah, 09h
        mov     dx, crlf
        int     21h

        mov     ax, 4C00h       ; exit, status 0
        int     21h

banner  db      'Doomsday IDE smoke test', 0Dh, 0Ah, 0Dh, 0Ah, 'Hello, World!', 0Dh, 0Ah, 0Ah, '$'
prompt  db      'Tell me Year: $'
echoed  db      'You typed: $'
crlf    db      0Dh, 0Ah, '$'

; AH=0Ah buffer layout:
;   byte 0  - max characters we accept, INCLUDING the terminating CR
;   byte 1  - DOS writes the count it actually read here
;   byte 2+ - the characters, terminated by 0Dh
inbuf   db      6               ; so: up to 5 typed characters, then CR
        db      0
        times   8 db 0
