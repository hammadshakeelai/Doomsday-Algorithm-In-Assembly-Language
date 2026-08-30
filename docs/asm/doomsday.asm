[org 0x100]


mov ah,0x09


mov dx,msg1
int 0x21


mov dx,msg2
int 0x21


mov dx,msg3
int 0x21


mov dx,msg4
int 0x21


mov ah,0x01
int 0x21

sub al,'0'


mov [year],al

int 0x21


sub al,'0'

mov [year+1],al

int 0x21


sub al,'0'

mov [year+2],al

int 0x21


sub al,'0'

mov [year+3],al

int 0x21



mov ah,0x09


;mov dx,msg5
;int 0x21


;mov dx,msg6
;int 0x21


mov dx,msg7
int 0x21


mov ah,0x01
int 0x21


sub al,'0'

mov [month],al

int 0x21


sub al,'0'

mov [month+1],al

int 0x21


mov ah,0x09


;mov dx,msg8
;int 0x21


;mov dx,msg9
;int 0x21


mov dx,msg10
int 0x21


mov ah,0x01
int 0x21


sub al,'0'

mov [date],al

int 0x21


sub al,'0'

mov [date+1],al

int 0x21


mov ah,0x09


;mov dx,msg11
;int 0x21


mov dx,msg12
int 0x21


;-----------

jmp aftervariables


    century db 0 ; byte[century]        
    ;BYTEEEEEEE
    ;temp db 0 ; byte[temp]             
    ;BYTEEEEEEE
    anchor db 0 ; byte[anchor]          
    ;BYTEEEEEEE


    ifcarry:
        add ah,1

        jmp back
aftervariables:


mov al,byte[year]
mov bl,10
mul bl
add al,byte[year+1]


jc ifcarry


back:
mov [century],al


sub al,20
mov bl,4
mov ah, 0
add al, 100
div bl


cmp ah,0
jge skip
add ah,4
skip:


;mov [temp],ah

    mov byte[anchor],3
    cmp ah,3
    je end


    mov byte[anchor],5
    cmp ah,2
    je end


    mov byte[anchor],0
    cmp ah,1
    je end


    mov byte[anchor],2


end: ;---- END OF CENTURY ANCHOR


; Century Anchor FOUND [anchor]byte
 

jmp agay


    fullyear dw 0 ; byte[fullyear]       
    ; WORDDDDDDD

    leapyear db 0 ; byte[leapyear]       
    ; BYTEEEEEEE

    ifcarry1:
        add ah,1

        jmp back21
    ifcarry2:
        add ah,1

        jmp back22
    ifcarry3:
        add ah,1

        jmp back23

agay:

;;;;;;;;;;;;;;;;;;;;caryy????


xor ah,ah 


mov bx,10


mov al,byte[year]
mul bx


add al,byte[year+1]
jc ifcarry1
back21:
mul bx


add al,byte[year+2]
jc ifcarry2
back22:
mul bx


add al,byte[year+3]
jc ifcarry3
back23:


mov [fullyear],ax



xor dx, dx
;mov ax,[fullyear]
mov bx,4
div bx


cmp dx,0
je mleap


jmp out1


mleap:
    xor dx, dx
    mov ax,[fullyear]
    mov bx,100
    div bx

    cmp dx,0

    jne yes
    jmp maybe


    maybe:
        xor dx, dx
        mov ax,[fullyear]
        mov bx,400
        div bx

        cmp dx,0

        je yes
        jmp out1        
    
    
    yes: 
        mov byte[leapyear],1

        jmp out1


out1:



;-----------------
;IF LEAPYEAR FOUND IN [leapyear] 
;BYTEEEEEEEEEE

jmp ahead

    monthnumber db 0
    doomdaydate db 0

    ly1:
        add byte[doomdaydate],1

        jmp back1


    ly2:
        add byte[doomdaydate],1

        jmp back2


ahead:


mov al,[month]
mov bl,10
mul bl
add al,[month+1]


mov [monthnumber],al


; FINDING TIME OF MONTH 
;WHEN DOOMSDAY IS OCCURRING 
;IN [doomdaydate] BYTE


mov byte[doomdaydate],3
mov ah,[leapyear]
cmp ah,1

je ly1

back1:
cmp al,1

je monthfound


mov byte[doomdaydate],28
mov ah,[leapyear]
cmp ah,1

je ly2

back2:
cmp al,2

je monthfound


mov byte[doomdaydate],14
cmp al,3
je monthfound


mov byte[doomdaydate],4
cmp al,4
je monthfound


mov byte[doomdaydate],9
cmp al,5
je monthfound


mov byte[doomdaydate],6
cmp al,6
je monthfound


mov byte[doomdaydate],11
cmp al,7
je monthfound


mov byte[doomdaydate],8
cmp al,8
je monthfound


mov byte[doomdaydate],5
cmp al,9
je monthfound


mov byte[doomdaydate],10
cmp al,10
je monthfound


mov byte[doomdaydate],7
cmp al,11
je monthfound


mov byte[doomdaydate],12
cmp al,12


monthfound:


;-----------

jmp final


    ;BYTEEEE
        sum db 0
        f1 db 0
        f2 db 0
        f3 db 0
        f4 db 0
        temp2 db 0


final:


mov al,byte[year+2]
mov bl,10  
 
mul bl
add al,byte[year+3]


mov [temp2],al


mov al,[anchor]
mov [f1],al


mov ah,0
mov al,[temp2]
mov bl,12
div bl
mov [f2],al


mov [f3],ah


mov al,ah
mov bl,4
mov ah,0
div bl
mov [f4],al


mov al,[f1]
mov [sum],al
mov al,[f2]
add [sum],al
mov al,[f3]
add [sum],al
mov al,[f4]
add [sum],al


mov al,[sum]
mov bl,7
mov ah,0
div bl
mov [sum],ah


;----------------
; sum      word
; doomdaydate  db 
; date convert karo - date db 0,0
; to day update   byte[day]


jmp next


    dateconverted db 0


next:


    mov al,byte[date]
    mov bl,10
    mul bl
    add al,byte[date+1]

    mov [dateconverted],al


    sub al,[doomdaydate]
    mov bl,7
    add al,35
    mov ah,0
    div bl
    mov al,ah
    xor ah,ah
    add al,[sum]
    ;xor bh,bh
    ;xor dx,dx
    mov ah,0
    div bl
    mov [day],ah

  
;-----------
;-----------



mov al,[year]
add al,'0'
mov dl,al

mov ah,0x02

int 0x21


mov al,[year+1]
add al,'0'
mov dl,al

int 0x21


mov al,[year+2]
add al,'0'
mov dl,al

int 0x21


mov al,[year+3]
add al,'0'
mov dl,al

int 0x21


mov dl,' '

int 0x21


mov dl,'\'

int 0x21


mov dl,' '

int 0x21


mov al,[month]
add al,'0'
mov dl,al

int 0x21


mov al,[month+1]
add al,'0'
mov dl,al

int 0x21


mov dl,' '

int 0x21


mov dl,'\'

int 0x21


mov dl,' '

int 0x21


mov al,[date]
add al,'0'
mov dl,al

int 0x21


mov al,[date+1]
add al,'0'
mov dl,al

int 0x21


mov dl,'t'

int 0x21


mov dl,'h'

int 0x21


jmp daytoname
backtodaytoname:


mov ah,0x09

mov dx,msg13
int 0x21


mov ah,0x09
mov dx,bx
int 0x21


mov ax,0x4c00
int 21h


year db 0,0,0,0 ; word[year] word[year+2]
month db 0,0 ; word[month]
date db 0,0 ; word[date]
day db 4 ; byte[day]


msg1 db 0x0a,' Welcome To Doomsday Date Machine',0x0d,0x0a,0x0a,'$'
msg2 db ' Choose any date using the Doomsday Algorithm',0x0d,0x0a,'$'
msg3 db ' This Machine will tell you the Day of the Week',0x0d,0x0a,0x0a,'$'
msg4 db ' Tell me Year: $' 
msg5 db 0x0d,0x0a,0x0a,' Wow its a Leap year$'
msg6 db 0x0d,0x0a,0x0a,' Century Anchor/start will be a : Tuesday$'
msg7 db 0x0d,0x0a,' Tell me Month: $'


msg8 db 0x0d,0x0a,0x0a,' Youre choosen month is: january$'
msg9 db 0x0d,0x0a,' In this month the Doomsday  is at: 4$'
msg10 db 0x0d,0x0a,' Tell me Day: $'


msg11 db 0x0d,0x0a,0x0a,' Doomsday is at 2th day of the week -> Tuesday$'
msg12 db 0x0d,0x0a,' So on Year $'
msg13 db 0x0d,0x0a,' the Day of the week is $'


dayname0 db 'Sunday',0x0d,0x0a,0x0a,'$'
dayname1 db 'Monday',0x0d,0x0a,0x0a,'$'
dayname2 db 'Tuesday',0x0d,0x0a,0x0a,'$'
dayname3 db 'Wednesday',0x0d,0x0a,0x0a,'$'
dayname4 db 'Thursday',0x0d,0x0a,0x0a,'$'
dayname5 db 'Friday',0x0d,0x0a,0x0a,'$'
dayname6 db 'Saturday',0x0d,0x0a,0x0a,'$'

daytobe dw 0


daytoname: ;backtodaytoname

    mov bx, dayname0
    
    cmp byte [day], 0
    je backtodaytoname
    
    mov bx, dayname1
    
    cmp byte [day], 1
    je backtodaytoname
    
    mov bx, dayname2

    cmp byte [day], 2
    je backtodaytoname

    mov bx, dayname3
    
    cmp byte [day], 3
    je backtodaytoname
    
    mov bx, dayname4
    
    cmp byte [day], 4
    je backtodaytoname
    
    mov bx, dayname5
    
    cmp byte [day], 5
    je backtodaytoname
    
    mov bx, dayname6


    jmp backtodaytoname


;#EOF