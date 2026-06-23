#!/bin/bash

# Auto Commit & Push Script
# Menambahkan semua perubahan, membuat commit, dan push ke GitHub

set -e

echo "🔍 Memeriksa status repository..."
git status

echo -e "\n📝 Menambahkan semua file yang berubah ke staging..."
git add .

echo -e "\n💬 Memasukkan commit message..."
read -p "Masukkan commit message (atau tekan Enter untuk default): " commit_msg
commit_msg=${commit_msg:-"Auto-commit: Update perubahan"}

echo -e "\n🔧 Melakukan commit..."
git commit -m "$commit_msg"

echo -e "\n🚀 Melakukan push ke GitHub..."
git push origin main

echo -e "\n✅ Selesai! Perubahan berhasil dipush ke GitHub"
echo -e "\n📊 Hasil akhir:"
git log -1 --oneline
