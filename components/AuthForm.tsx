"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { signIn, signUp } from "@/lib/actions/auth.action";
import FormField from "./FormField";

const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(3),
  });
};

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();

  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (type === "sign-up") {
        const { name, email, password } = data;

        // First create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Then create the user in our database
        const result = await signUp({
          uid: userCredential.user.uid,
          name: name!,
          email,
        });

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        toast.success(result.message);
        router.push("/sign-in");
      } else {
        const { email, password } = data;

        try {
          // First authenticate with Firebase
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
          );

          // Force refresh the token to ensure it's fresh
          const idToken = await userCredential.user.getIdToken(true);
          
          // Then create the session
          const result = await signIn({
            email,
            idToken,
          });

          if (!result.success) {
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
          router.refresh(); // Refresh to update auth state
          router.push("/"); // Redirect to home
        } catch (signInError: any) {
          console.error("Sign in error:", signInError);
          
          // Handle specific Firebase Auth errors
          switch (signInError.code) {
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
              toast.error("Invalid email or password. Please try again.");
              break;
            case 'auth/user-not-found':
              toast.error("No account found with this email. Please sign up first.");
              break;
            case 'auth/invalid-email':
              toast.error("Invalid email address.");
              break;
            case 'auth/too-many-requests':
              toast.error("Too many failed attempts. Please try again later.");
              break;
            default:
              toast.error("Failed to sign in. Please try again.");
          }
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      
      // Handle specific Firebase Auth errors for sign up
      switch (error.code) {
        case 'auth/email-already-in-use':
          toast.error("An account with this email already exists. Please sign in instead.");
          break;
        case 'auth/invalid-email':
          toast.error("Invalid email address.");
          break;
        case 'auth/weak-password':
          toast.error("Password is too weak. Please use a stronger password.");
          break;
        case 'auth/network-request-failed':
          toast.error("Network error. Please check your internet connection.");
          break;
        default:
          toast.error("Failed to create account. Please try again.");
      }
    }
  };

  const isSignIn = type === "sign-in";

  return (
    <div className="card-border lg:min-w-[566px]">
      <div className="flex flex-col gap-6 card py-14 px-10">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.svg" alt="logo" height={32} width={38} />
          <h2 className="text-primary-100">PrepWise</h2>
        </div>

        <h3>Prepare for job interviews with AI</h3>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="w-full space-y-6 mt-4 form"
          >
            {!isSignIn && (
              <FormField
                control={form.control}
                name="name"
                label="Name"
                placeholder="Your Name"
                type="text"
              />
            )}

            <FormField
              control={form.control}
              name="email"
              label="Email"
              placeholder="Your email address"
              type="email"
            />

            <FormField
              control={form.control}
              name="password"
              label="Password"
              placeholder="Enter your password"
              type="password"
            />

            <Button className="btn" type="submit">
              {isSignIn ? "Sign In" : "Create an Account"}
            </Button>
          </form>
        </Form>

        <p className="text-center">
          {isSignIn ? "No account yet?" : "Have an account already?"}
          <Link
            href={!isSignIn ? "/sign-in" : "/sign-up"}
            className="font-bold text-user-primary ml-1"
          >
            {!isSignIn ? "Sign In" : "Sign Up"}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;
