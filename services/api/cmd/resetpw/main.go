package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	password := "Admin@1234"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		fmt.Println("hash error:", err)
		os.Exit(1)
	}

	dbURL := "postgres://postgres:postgres@localhost:5432/abc_exam?sslmode=disable"
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		fmt.Println("db error:", err)
		os.Exit(1)
	}
	defer pool.Close()

	_, err = pool.Exec(context.Background(),
		"UPDATE users SET password_hash = $1 WHERE email = 'admin@abcexam.com'",
		string(hash),
	)
	if err != nil {
		fmt.Println("update error:", err)
		os.Exit(1)
	}
	fmt.Println("Password updated successfully. Login with Admin@1234")
}
