@echo off

set domain=%1
set outputPath=%2
set curPath=%3
set commonname=%domain%

set country=CN
set state=ZJ
set locality=HZ
set organization=Alibaba
set organizationalunit=FE
set email=fe@alibaba-inc.com
set password=123456

openssl genrsa -passout pass:%password% -out %outputPath%/%domain%.key 2048

openssl rsa -in %outputPath%/%domain%.key -passin pass:%password% -out %outputPath%/%domain%.key

openssl req -new -key %outputPath%/%domain%.key -out %outputPath%/%domain%.csr -passin pass:%password% -subj /C=%country%/ST=%state%/L=%locality%/O=%organization%/OU=%organizationalunit%/CN=%commonname%/emailAddress=%email%

openssl x509 -req -days 36500 -in %outputPath%/%domain%.csr -CA %curPath%/rootCA.crt -CAkey %curPath%/rootCA.key -CAcreateserial -out %outputPath%/%domain%.crt

del %outputPath%/%domain%.csr