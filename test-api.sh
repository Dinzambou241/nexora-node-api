#!/bin/bash

# Script de test pour ORION FILM API

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Test de l'API ORION FILM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Health Check
echo "1️⃣  Test Health Check"
echo "GET $BASE_URL/api/health"
echo ""
curl -s "$BASE_URL/api/health" | jq '.'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2: Film populaire (Avengers Endgame)
echo "2️⃣  Test Film - Avengers: Endgame (TMDB: 299534)"
echo "GET $BASE_URL/api/sources/movie/299534"
echo ""
echo "⏳ Scraping en cours (peut prendre 5-15 secondes)..."
echo ""
curl -s "$BASE_URL/api/sources/movie/299534" | jq '.'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3: Autre film (The Matrix)
echo "3️⃣  Test Film - The Matrix (TMDB: 603)"
echo "GET $BASE_URL/api/sources/movie/603"
echo ""
echo "⏳ Scraping en cours..."
echo ""
curl -s "$BASE_URL/api/sources/movie/603" | jq '.'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 4: Film introuvable
echo "4️⃣  Test Film introuvable (TMDB: 999999999)"
echo "GET $BASE_URL/api/sources/movie/999999999"
echo ""
curl -s "$BASE_URL/api/sources/movie/999999999" | jq '.'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ Tests terminés !"
echo ""
echo "💡 Pour tester avec un autre serveur :"
echo "   ./test-api.sh https://votre-domaine.com"
