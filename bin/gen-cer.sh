#!/bin/bash
 
#Required
domain=$1
outputPath=$2
curPath=$3
commonname=$domain
 
#Change to your company details
country=CN
state=ZJ
locality=HZ
organization=Alibaba
organizationalunit=FE
email=fe@alibaba-inc.com
 
#Optional
password=123456

#Generate a key
openssl genrsa -passout pass:$password -out $outputPath/$domain.key 2048

#Remove passphrase from the key. Comment the line out to keep the passphrase
openssl rsa -in $outputPath/$domain.key -passin pass:$password -out $outputPath/$domain.key
 
#Create the request
openssl req -new -key $outputPath/$domain.key -out $outputPath/$domain.csr -passin pass:$password -subj "/C=$country/ST=$state/L=$locality/O=$organization/OU=$organizationalunit/CN=$commonname/emailAddress=$email"
 
#Generating a Self-Signed Certificate
openssl x509 -req -days 36500 -in $outputPath/$domain.csr -CA ${curPath}/rootCA.crt -CAkey ${curPath}/rootCA.key -CAcreateserial -out $outputPath/$domain.crt

rm $outputPath/$domain.csr