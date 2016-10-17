#!/bin/sh

# XPI Name
_xpiName=NST-0.63-ko.xpi

# Check if the build directory exists
if [ -d ./build ]
then
  # Clear the contents of the directory
  rm -rf ./build/*
else
  mkdir ./build
fi

mkdir ./build/xpi

# Copy the files and folders required into the build directory
cp -r ./content ./build/xpi/
cp -r ./skin ./build/xpi/
cp -r ./xtk2 ./build/xpi/
cp chrome.manifest ./build/xpi/
cp install.rdf ./build/xpi/

# Remove old XPI file name
rm -f $_xpiName

# Create the XPI file
cd ./build/xpi/
zip -X -r $_xpiName *

cp $_xpiName ../../