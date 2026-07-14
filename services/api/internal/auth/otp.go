package auth

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	otpTTL          = 10 * time.Minute
	resetTokenTTL   = 15 * time.Minute
	otpKeyPrefix    = "otp:"
	resetKeyPrefix  = "reset:"
)

func generateOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func storeOTP(ctx context.Context, rdb *redis.Client, email, otp string) error {
	key := otpKeyPrefix + email
	return rdb.Set(ctx, key, otp, otpTTL).Err()
}

func verifyOTP(ctx context.Context, rdb *redis.Client, email, otp string) (bool, error) {
	key := otpKeyPrefix + email
	stored, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if stored != otp {
		return false, nil
	}
	rdb.Del(ctx, key)
	return true, nil
}

func storeResetToken(ctx context.Context, rdb *redis.Client, token, userID string) error {
	key := resetKeyPrefix + token
	return rdb.Set(ctx, key, userID, resetTokenTTL).Err()
}

func getResetToken(ctx context.Context, rdb *redis.Client, token string) (string, error) {
	key := resetKeyPrefix + token
	userID, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	rdb.Del(ctx, key)
	return userID, nil
}
